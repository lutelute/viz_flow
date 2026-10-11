import { useEffect, useState, type RefObject } from 'react';

export interface Box { width: number; height: number }

/** 要素の内寸を ResizeObserver で追う。 */
export function useElementSize(ref: RefObject<HTMLElement | null>): Box {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setBox((b) => (b.width === r.width && b.height === r.height ? b : { width: r.width, height: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

/** viewBox の縦横比を保って枠に収める寸法。上限倍率を超えては拡大しない。 */
export function fitBox(view: Box, into: Box, maxScale: number): Box {
  if (view.width <= 0 || view.height <= 0 || into.width <= 0 || into.height <= 0) return { width: 0, height: 0 };
  const s = Math.min(into.width / view.width, into.height / view.height, maxScale);
  return { width: Math.floor(view.width * s), height: Math.floor(view.height * s) };
}
