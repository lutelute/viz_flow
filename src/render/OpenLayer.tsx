import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { NodeBox, Rect } from '../layout/types';
import type { RenderCtx } from '../skins/types';

// 「ひらく」の当たり判定と印。画面でだけ重ねる。書き出しには出さない。
// 印は部品の右下の角を折った形にする。「めくると中がある」を形で示す。

export interface OpenTarget {
  id: string;
  /** 読み上げとツールチップに使う部品の名前 */
  label: string;
}

export interface OpenHandlers {
  items: OpenTarget[];
  /** el はクリックされた要素。ズームの起点に使う */
  onOpen: (id: string, el: Element) => void;
}

const FOLD = 16;
const INSET = 6;
const RING = 7;

export function foldMark(ctx: RenderCtx, r: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const x1 = r.x + r.width - INSET;
  const y1 = r.y + r.height - INSET;
  const x0 = x1 - FOLD;
  const y0 = y1 - FOLD;
  return (
    <>
      <path d={`M${x0} ${y1}L${x1} ${y0}L${x1} ${y1}Z`} fill={t.tone.accent1} />
      <path d={`M${x0 + 3} ${y1 - 3}L${x1 - 3} ${y0 + 3}`} stroke={t.bg} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function ring(ctx: RenderCtx, r: Rect, radius: number): ReactNode {
  const t = ctx.skin.tokens;
  return (
    <rect
      x={r.x - RING}
      y={r.y - RING}
      width={r.width + RING * 2}
      height={r.height + RING * 2}
      rx={radius + RING / 2}
      fill="none"
      stroke={t.tone.accent1}
      strokeWidth={2.5}
      strokeDasharray="7 5"
    />
  );
}

function activate(e: KeyboardEvent<SVGGElement>, run: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    run();
  }
}

/** 1 つの部品か 1 つのセルを、押せる要素にする。 */
export function OpenHit({ ctx, rect, radius, id, label, onOpen, look }: { ctx: RenderCtx; rect: Rect; radius: number; id: string; label: string; onOpen: OpenHandlers['onOpen']; look?: { mark: ReactNode; ring: ReactNode } }): ReactNode {
  const shown = look ?? { mark: foldMark(ctx, rect), ring: ring(ctx, rect, radius) };
  const name = /[A-Za-z0-9]$/.test(label) ? `${label} の中をひらく` : `${label}の中をひらく`;
  return (
    <g
      className="vf-open"
      role="button"
      tabIndex={0}
      aria-label={name}
      data-open={id}
      onClick={(e: MouseEvent<SVGGElement>) => onOpen(id, e.currentTarget)}
      onKeyDown={(e) => activate(e, () => onOpen(id, e.currentTarget))}
    >
      <title>{name}</title>
      <g className="vf-open__ring">{shown.ring}</g>
      <g className="vf-open__mark" aria-hidden="true">
        {shown.mark}
      </g>
      <rect className="vf-open__hit" x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={radius} fill="transparent" />
    </g>
  );
}

export function OpenLayer({ ctx, boxes, open }: { ctx: RenderCtx; boxes: Map<string, NodeBox>; open: OpenHandlers }): ReactNode {
  const radius = ctx.skin.tokens.radius.node;
  return (
    <g data-layer="open">
      {open.items.map((it) => {
        const b = boxes.get(it.id);
        if (!b) return null;
        const look = ctx.skin.OpenMark?.(ctx, b);
        return <OpenHit key={it.id} ctx={ctx} rect={{ x: b.x, y: b.y, width: b.w, height: b.h }} radius={radius} id={it.id} label={it.label} onOpen={open.onOpen} look={look} />;
      })}
    </g>
  );
}
