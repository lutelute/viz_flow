import type { Diagram } from '../model/diagram';
import type { LayoutWarning, NodeBox, Rect, ResolvedLayout } from './types';
import { segmentHitsRect } from './route';

const TOUCH_TOLERANCE = 0.5;

function rectOf(n: NodeBox): Rect {
  return { x: n.x, y: n.y, width: n.w, height: n.h };
}

function overlaps(a: Rect, b: Rect, tol: number): boolean {
  return (
    a.x + a.width - tol > b.x &&
    b.x + b.width - tol > a.x &&
    a.y + a.height - tol > b.y &&
    b.y + b.height - tol > a.y
  );
}

/**
 * レイアウト結果の機械検査。線とノード、ノード同士、ラベルと箱、ラベル同士の重なり、
 * 同じセルの衝突、参照切れを warnings として返す。
 */
export function validateLayout(layout: ResolvedLayout, diagram: Diagram): LayoutWarning[] {
  const out: LayoutWarning[] = [];
  const nodes = [...layout.nodes.values()];

  for (const n of diagram.nodes) {
    if (!layout.lanes.has(n.lane)) {
      out.push({ kind: 'missing-ref', ids: [n.id, n.lane], message: `ノード ${n.id} のレーン ${n.lane} が無い` });
    }
  }
  for (const e of diagram.edges) {
    for (const end of [e.from, e.to]) {
      if (!layout.nodes.has(end)) {
        out.push({ kind: 'missing-ref', ids: [e.id, end], message: `エッジ ${e.id} のノード ${end} が無い` });
      }
    }
  }
  for (const g of diagram.groups ?? []) {
    for (const id of g.nodes) {
      if (!layout.nodes.has(id)) {
        out.push({ kind: 'missing-ref', ids: [g.id, id], message: `グループ ${g.id} のノード ${id} が無い` });
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (Math.abs(a.cx - b.cx) < TOUCH_TOLERANCE && Math.abs(a.cy - b.cy) < TOUCH_TOLERANCE) {
        out.push({ kind: 'cell-collision', ids: [a.id, b.id], message: `${a.id} と ${b.id} が同じセルにある` });
        continue;
      }
      if (overlaps(rectOf(a), rectOf(b), TOUCH_TOLERANCE)) {
        out.push({ kind: 'node-overlap', ids: [a.id, b.id], message: `${a.id} と ${b.id} の箱が重なる` });
      }
    }
  }

  const edgeOf = new Map(diagram.edges.map((e) => [e.id, e] as const));
  for (const g of layout.edges.values()) {
    const e = edgeOf.get(g.id);
    const ends = new Set(e ? [e.from, e.to] : []);
    for (const n of nodes) {
      if (ends.has(n.id)) continue;
      const r = rectOf(n);
      for (let i = 0; i < g.points.length - 1; i++) {
        if (segmentHitsRect(g.points[i], g.points[i + 1], r, 1)) {
          out.push({ kind: 'edge-crosses-node', ids: [g.id, n.id], message: `エッジ ${g.id} がノード ${n.id} を横切る` });
          break;
        }
      }
    }
  }

  const labeled = [...layout.edges.values()].filter((g) => g.label);
  for (const g of labeled) {
    for (const n of nodes) {
      if (overlaps(g.label!.box, rectOf(n), 1)) {
        out.push({ kind: 'label-overlaps-node', ids: [g.id, n.id], message: `エッジ ${g.id} のラベルがノード ${n.id} に重なる` });
      }
    }
  }
  for (let i = 0; i < labeled.length; i++) {
    for (let j = i + 1; j < labeled.length; j++) {
      const a = labeled[i];
      const b = labeled[j];
      if (overlaps(a.label!.box, b.label!.box, TOUCH_TOLERANCE)) {
        out.push({ kind: 'label-overlap', ids: [a.id, b.id], message: `エッジ ${a.id} と ${b.id} のラベルが重なる` });
      }
    }
  }
  return out;
}
