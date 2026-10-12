import type { FontFace } from '../skins/types';
import type { Pt, Rect, ResolvedLayout, TextMeasurer } from '../layout/types';
import type { CompiledStep } from '../timeline/types';
import { posAt } from '../core/particle-math';

// 動いている粒子の字（「質問」「上位 3 件」）を、番号・辺のラベル・部品の名前に重ねないための下調べ。
// 番号と辺のラベルは線の上（縦の線なら左）に寄せてあるので、字は線の下（縦の線なら右）に出すのが基本。
// どちらに出すかは辺ごとに 1 回だけ決める。途中で入れ替わると字が跳ねて見えるため。

/** below は横に進むとき線の下、縦に進むとき線の右。above はその反対 */
export type LabelSide = 'below' | 'above';

export interface LabelRoom {
  /** 辺の経路全体を見て、字の枠がぶつかる回数の少ない側。同じなら下 */
  side(edgeId: string, w: number, h: number, gap: number): LabelSide;
  /** 字の枠がどれかにぶつかるか。ぶつかる間は字を出さない */
  blocked(box: Rect): boolean;
}

/** 番号の丸の半径（様式で 12〜13）に余白を足したもの */
const BADGE_CLEAR = 15;
const SAMPLES = 24;

/** heading は進む向き（度、0 = 右）。縦に進むときは字を線の横に出し、線そのものに札を被せない */
export function labelBox(at: Pt, heading: number, w: number, h: number, gap: number, side: LabelSide): Rect {
  const rad = (heading * Math.PI) / 180;
  const vertical = Math.abs(Math.sin(rad)) > Math.abs(Math.cos(rad));
  if (vertical) return { x: side === 'below' ? at.x + gap : at.x - gap - w, y: at.y - h / 2, width: w, height: h };
  return { x: at.x - w / 2, y: side === 'below' ? at.y + gap : at.y - gap - h, width: w, height: h };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function obstaclesOf(layout: ResolvedLayout, steps: CompiledStep[], measure: TextMeasurer, label: FontFace): Rect[] {
  const out: Rect[] = [];
  for (const s of steps) out.push({ x: s.badge.x - BADGE_CLEAR, y: s.badge.y - BADGE_CLEAR, width: BADGE_CLEAR * 2, height: BADGE_CLEAR * 2 });
  for (const g of layout.edges.values()) {
    if (!g.label) continue;
    const b = g.label.box;
    out.push({ x: b.x - 5, y: b.y - 4, width: b.width + 10, height: b.height + 8 });
  }
  for (const n of layout.nodes.values()) {
    if (!n.disc) {
      out.push({ x: n.x, y: n.y, width: n.w, height: n.h });
      continue;
    }
    out.push({ x: n.cx - n.disc, y: n.cy - n.disc, width: n.disc * 2, height: n.disc * 2 });
    if (n.labelLines.length > 0) {
      const w = Math.max(...n.labelLines.map((l) => measure.width(l, label.family, label.size, label.weight)));
      const top = n.cy + n.disc + 4;
      out.push({ x: n.cx - w / 2, y: top, width: w, height: n.y + n.h - top });
    }
  }
  return out;
}

function makeRoom(layout: ResolvedLayout, steps: CompiledStep[], measure: TextMeasurer, label: FontFace): LabelRoom {
  const obstacles = obstaclesOf(layout, steps, measure, label);
  const sides = new Map<string, LabelSide>();
  const blocked = (box: Rect) => obstacles.some((o) => overlaps(box, o));
  return {
    blocked,
    side(edgeId, w, h, gap) {
      const key = `${edgeId}|${Math.round(w)}|${Math.round(h)}|${gap}`;
      const known = sides.get(key);
      if (known) return known;
      const route = layout.edges.get(edgeId)?.route;
      let below = 0;
      let above = 0;
      if (route && route.totalLen > 0) {
        for (let i = 1; i < SAMPLES; i++) {
          const p = posAt(route, i / SAMPLES);
          const q = posAt(route, Math.min(1, i / SAMPLES + 0.01));
          const heading = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          if (blocked(labelBox(p, heading, w, h, gap, 'below'))) below++;
          if (blocked(labelBox(p, heading, w, h, gap, 'above'))) above++;
        }
      }
      const side: LabelSide = above < below ? 'above' : 'below';
      sides.set(key, side);
      return side;
    },
  };
}

const rooms = new WeakMap<ResolvedLayout, WeakMap<CompiledStep[], LabelRoom>>();

/** 同じレイアウトとステップには同じ下調べを返す（毎フレーム作り直さない） */
export function labelRoomFor(layout: ResolvedLayout, steps: CompiledStep[], measure: TextMeasurer, label: FontFace): LabelRoom {
  let byLayout = rooms.get(layout);
  if (!byLayout) {
    byLayout = new WeakMap();
    rooms.set(layout, byLayout);
  }
  let room = byLayout.get(steps);
  if (!room) {
    room = makeRoom(layout, steps, measure, label);
    byLayout.set(steps, room);
  }
  return room;
}
