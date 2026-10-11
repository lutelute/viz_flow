import { useLayoutEffect, useRef, type RefObject } from 'react';

// 「ひらく」の移り変わり。ひらくときは押した部品の位置から図が広がり、
// もどるときは元の部品が画面いっぱいの所から縮んで戻る。
// 図の中で押しても、右の欄から選んでも、キーで選んでも同じ動きにするため、
// 段が替わるたびに「ひらける部品が図のどこにあるか」を図に対する割合で控えておく。
// 時計は使わず Web Animations に任せる。動きを減らす設定では何もしない。

interface Frac {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DURATION = 360;
const EASE = 'cubic-bezier(.2,.7,.2,1)';

function fracOf(el: Element, frame: Element): Frac | null {
  const a = el.getBoundingClientRect();
  const b = frame.getBoundingClientRect();
  if (b.width <= 0 || b.height <= 0 || a.width <= 0) return null;
  return { x: (a.left - b.left) / b.width, y: (a.top - b.top) / b.height, w: a.width / b.width, h: a.height / b.height };
}

function snapshot(frame: HTMLElement): Map<string, Frac> {
  const out = new Map<string, Frac>();
  frame.querySelectorAll('[data-open]').forEach((el) => {
    const id = el.getAttribute('data-open');
    const f = id ? fracOf(el, frame) : null;
    if (id && f) out.set(id, f);
  });
  return out;
}

function play(frame: HTMLElement, from: string, opacity: number) {
  frame.animate(
    [
      { transformOrigin: '0 0', transform: from, opacity },
      { transformOrigin: '0 0', transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ],
    { duration: DURATION, easing: EASE },
  );
}

/** viewKey が変わったら、深くなったか浅くなったかで向きを決めて動かす。 */
export function useZoom(frameRef: RefObject<HTMLElement | null>, viewKey: string, path: readonly string[], reduced: boolean, ready: boolean): void {
  const prev = useRef<{ key: string; path: readonly string[]; spots: Map<string, Frac> } | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !ready) return;
    const before = prev.current;
    prev.current = { key: viewKey, path, spots: snapshot(frame) };
    if (!before || before.key === viewKey || reduced || typeof frame.animate !== 'function') return;
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    if (W <= 0 || H <= 0) return;

    if (path.length > before.path.length) {
      // ひらいた: 前の段で押した部品の位置から広げる
      const start = before.spots.get(path[before.path.length]);
      if (!start) return;
      const s = Math.max(0.05, start.w);
      play(frame, `translate(${start.x * W}px, ${start.y * H + (start.h * H - H * s) / 2}px) scale(${s})`, 0.15);
      return;
    }
    if (path.length < before.path.length) {
      // もどった: 今の段でさっきひらいていた部品が画面いっぱいの所から縮める
      const f = prev.current.spots.get(before.path[path.length]);
      if (!f) return;
      const S = Math.min(8, 1 / Math.max(0.05, f.w));
      play(frame, `translate(${-f.x * W * S}px, ${-(f.y + f.h / 2) * H * S + H / 2}px) scale(${S})`, 0.3);
    }
  }, [viewKey, path, frameRef, reduced, ready]);
}
