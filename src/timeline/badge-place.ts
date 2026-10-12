import type { EdgeGeom, NodeBox, Pt, Rect, ResolvedLayout } from '../layout/types';
import { posAt } from '../core/particle-math';

// 番号の丸は、辺のラベルがあればラベルと同じ側にラベルを避けて並べ、無ければ線の上（縦の線なら左）に置く。
// 書き込みを片側に寄せ、反対側を動く粒子の字に空けておくため。
// そこが別の線・辺のラベル・部品・先に置いた番号に掛かるときは、同じ辺に沿って前後へずらし、駄目なら反対側へ移す。
// どこへ動かしても掛かるなら、掛かる数がいちばん少ない所に置く。

/** バッジを経路から離す距離（px） */
export const BADGE_OFFSET = 26;
/** 様式の丸の半径（12〜13）に余白を足した、ぶつかりを見る半径 */
const CLEAR = 15;
/** 番号どうしの中心の間隔の下限 */
const BADGE_APART = 36;
/** 前後へずらす刻み（px）と回数。ラベルの横に並べられる距離まで */
const STEP_PX = 10;
const TRIES = 8;

export interface BadgeSeed {
  pt: Pt;
  /** 辺に付く番号なら、その辺と経路上の位置。部品の角に付く番号は動かさない */
  geom?: EdgeGeom;
  at?: number;
  /** 最初の辺のどこにも置き場が無いときに試す、同じステップで粒子が通るほかの辺 */
  alts?: Array<{ geom: EdgeGeom; at: number }>;
  /** 同じステップの繰り返しは、最初の位置をそのまま使う */
  key: object;
}

/** 経路上の位置 at から、進行方向の左手（side = 1）か右手（side = -1）へ BADGE_OFFSET 離した点 */
export function offsetOnRoute(geom: EdgeGeom, at: number, side: 1 | -1): Pt | null {
  const route = geom.route;
  if (route.totalLen === 0) return null;
  const eps = Math.min(0.01, 1 / route.totalLen);
  const t0 = Math.max(0, Math.min(1 - eps, at));
  const p = posAt(route, at);
  const a = posAt(route, t0);
  const b = posAt(route, t0 + eps);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: p.x + side * (dy / len) * BADGE_OFFSET, y: p.y - side * (dx / len) * BADGE_OFFSET };
}

/** 経路上の位置 at での進む向き（長さ 1） */
function tangentAt(geom: EdgeGeom, at: number): Pt {
  const eps = Math.min(0.01, 1 / Math.max(1, geom.route.totalLen));
  const a = posAt(geom.route, Math.max(0, Math.min(1 - eps, at)));
  const b = posAt(geom.route, Math.max(eps, Math.min(1, at + eps)));
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function circleHitsRect(p: Pt, r: number, box: Rect): boolean {
  const nx = Math.max(box.x, Math.min(p.x, box.x + box.width));
  const ny = Math.max(box.y, Math.min(p.y, box.y + box.height));
  return Math.hypot(p.x - nx, p.y - ny) < r;
}

/**
 * 部品の見えている範囲。丸を描く様式では箱の大半が空白なので、丸と名前の幅だけにする。
 * 名前の幅はここでは測れないので、全角 1 字を 18px として見積もる。
 */
function nodeRect(box: NodeBox): Rect {
  if (!box.disc) return { x: box.x, y: box.y, width: box.w, height: box.h };
  const longest = Math.max(0, ...box.labelLines.map((l) => l.length));
  const half = Math.min(box.w / 2, Math.max(box.disc, longest * 9));
  const top = box.cy - box.disc;
  return { x: box.cx - half, y: top, width: half * 2, height: box.y + box.h - top };
}

class Obstacles {
  private readonly lines: Array<{ id: string; points: Pt[] }> = [];
  private readonly rects: Rect[] = [];
  private readonly badges: Pt[] = [];
  private readonly figure: Rect;

  constructor(layout: ResolvedLayout) {
    for (const g of layout.edges.values()) {
      this.lines.push({ id: g.id, points: g.points });
      if (g.label) {
        const b = g.label.box;
        this.rects.push({ x: b.x - 5, y: b.y - 4, width: b.width + 10, height: b.height + 8 });
      }
    }
    for (const n of layout.nodes.values()) this.rects.push(nodeRect(n));
    this.figure = layout.figure;
  }

  /** own は番号が付く辺。自分の線からは BADGE_OFFSET 離して置くので、それより近い所（曲がり角の内側）だけを数える */
  hits(p: Pt, own?: string): number {
    let n = 0;
    for (const { id, points: pts } of this.lines) {
      const near = id === own ? BADGE_OFFSET - 4 : CLEAR;
      for (let i = 0; i + 1 < pts.length; i++) {
        if (segDist(p, pts[i], pts[i + 1]) < near) {
          n++;
          break;
        }
      }
    }
    for (const r of this.rects) if (circleHitsRect(p, CLEAR, r)) n++;
    // 番号どうしは丸が接して「52」と読めないよう、丸 2 つぶんより少し離す
    for (const b of this.badges) if (Math.hypot(p.x - b.x, p.y - b.y) < BADGE_APART) n++;
    // 図の枠から丸がはみ出さない（丸の半径ぶん内側）
    const f = this.figure;
    const m = 12;
    if (p.x < f.x + m || p.x > f.x + f.width - m || p.y < f.y + m || p.y > f.y + f.height - m) n++;
    return n;
  }

  add(p: Pt): void {
    this.badges.push(p);
  }
}

/** 書き込みを寄せる側。辺のラベルがあればその側、無ければ画面の上（縦の線なら左） */
function annotationSide(geom: EdgeGeom, at: number): 1 | -1 {
  const left = offsetOnRoute(geom, at, 1)!;
  const right = offsetOnRoute(geom, at, -1)!;
  if (geom.label) {
    const lp = geom.label.pos;
    return Math.hypot(left.x - lp.x, left.y - lp.y) <= Math.hypot(right.x - lp.x, right.y - lp.y) ? 1 : -1;
  }
  const leftIsUp = left.y < right.y - 0.01 || (Math.abs(left.y - right.y) <= 0.01 && left.x < right.x);
  return leftIsUp ? 1 : -1;
}

/**
 * 候補を、書き込みの側の近い所から順に並べる。
 * 前後は画面の左（縦の線なら上）を先に試し、「④ 同じモデルで」のように番号がラベルの前に来るようにする。
 * ずらすのは同じ直線の区間の中だけ。曲がり角を越えると、進む向きに対して同じ側でも画面では別の側になるため。
 */
function candidates(seed: BadgeSeed): Pt[] {
  const { geom, at } = seed;
  const a0 = at === undefined || !geom ? null : offsetOnRoute(geom, at, 1);
  if (!geom || at === undefined || !a0) return [seed.pt];
  const prefer = annotationSide(geom, at);
  const step = STEP_PX / geom.route.totalLen;
  // 経路を at の少し先へ進めたとき、画面の右（下）へ進むなら、手前（at を減らす向き）が左（上）
  const ahead = offsetOnRoute(geom, Math.min(1, at + step), 1) ?? a0;
  const horizontal = Math.abs(ahead.x - a0.x) >= Math.abs(ahead.y - a0.y);
  const forwardIsLater = horizontal ? ahead.x >= a0.x : ahead.y >= a0.y;
  const dirs = forwardIsLater ? [-1, 1] : [1, -1];
  const t0 = tangentAt(geom, at);
  const out: Pt[] = [];
  for (const side of [prefer, -prefer as 1 | -1]) {
    for (let k = 0; k <= TRIES; k++) {
      for (const dir of k === 0 ? [0] : dirs) {
        const a = at + dir * k * step;
        if (a < 0.1 || a > 0.9) continue;
        const t = tangentAt(geom, a);
        if (t.x * t0.x + t.y * t0.y < 0.99) continue;
        const p = offsetOnRoute(geom, a, side);
        if (p) out.push(p);
      }
    }
  }
  return out.length > 0 ? out : [seed.pt];
}

export function settleBadges(layout: ResolvedLayout, seeds: BadgeSeed[]): Pt[] {
  const obstacles = new Obstacles(layout);
  const placed = new Map<object, Pt>();
  return seeds.map((seed) => {
    const again = placed.get(seed.key);
    if (again) return again;
    let best = seed.pt;
    let bestHits = Infinity;
    const tries: Array<Pick<BadgeSeed, 'pt' | 'geom' | 'at'>> = [seed, ...(seed.alts ?? []).map((a) => ({ ...a, pt: a.geom.badgeAt }))];
    for (const t of tries) {
      for (const c of candidates({ ...t, key: seed.key })) {
        const h = obstacles.hits(c, t.geom?.id);
        if (h < bestHits) {
          best = c;
          bestHits = h;
          if (h === 0) break;
        }
      }
      if (bestHits === 0) break;
    }
    obstacles.add(best);
    placed.set(seed.key, best);
    return best;
  });
}
