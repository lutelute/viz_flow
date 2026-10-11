import type { ResolvedLayout } from '../layout/types';

export interface Bounds { x: number; y: number; width: number; height: number }

/** 図を構成する要素（レーン・箱・線・ラベル・バッジ）の外接矩形 */
export function figureBounds(layout: ResolvedLayout): Bounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number, w = 0, h = 0) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  };
  for (const r of layout.lanes.values()) add(r.x, r.y, r.width, r.height);
  for (const r of layout.groups.values()) add(r.x, r.y, r.width, r.height);
  for (const n of layout.nodes.values()) add(n.x, n.y, n.w, n.h);
  for (const e of layout.edges.values()) {
    for (const p of e.points) add(p.x, p.y);
    if (e.label) add(e.label.box.x, e.label.box.y, e.label.box.width, e.label.box.height);
    add(e.badgeAt.x - 16, e.badgeAt.y - 16, 32, 32);
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export const FIT_PAD = 8;
export const FIT_MAX = 1.6;

/** figure 枠に収めるための倍率。1 なら等倍、1 未満は縮小。 */
export function fitScale(layout: ResolvedLayout): number {
  const b = figureBounds(layout);
  if (!b) return 1;
  const f = layout.figure;
  const sx = (f.width - FIT_PAD * 2) / b.width;
  const sy = (f.height - FIT_PAD * 2) / b.height;
  return Math.min(sx, sy, FIT_MAX);
}

/** figure 枠の中央に収める transform。等倍なら undefined。 */
export function fitTransform(layout: ResolvedLayout): string | undefined {
  const b = figureBounds(layout);
  if (!b) return undefined;
  const s = fitScale(layout);
  const f = layout.figure;
  const cx = f.x + f.width / 2;
  const tx = Math.round(cx - (b.x + b.width / 2) * s);
  // 縦に余るときは題名の近くに寄せる（中央だと副題と図の間が空きすぎる）
  const slack = f.height - b.height * s;
  const top = f.y + Math.min(slack / 2, Math.max(24, slack * 0.25));
  const ty = Math.round(top - b.y * s);
  return `translate(${tx} ${ty}) scale(${s.toFixed(4)})`;
}
