// テスト用の手作りレイアウト。ノードを一列に並べ、隣どうしを 220px の直線で結ぶ。
// 速度 220 px/秒なら 1 本の travel がちょうど 1 秒になる。

import type { Diagram, DiagramEdge, DiagramNode, Payload, Step } from '../model/diagram';
import type { EdgeGeom, NodeBox, ResolvedLayout } from '../layout/types';
import { buildSegments } from '../core/particle-math';

export const BOX_W = 80;
export const BOX_H = 50;
export const PITCH = 300;
export const ROW_Y = 100;
/** 隣のノードどうしを結ぶ直線の長さ */
export const EDGE_LEN = PITCH - BOX_W;

export const QUERY: Payload = { kind: 'query', label: '質問' };
export const CHUNKS: Payload = { kind: 'chunks', label: '文書', count: 3 };
export const ANSWER: Payload = { kind: 'answer', label: '回答' };

export function lineBox(id: string, index: number): NodeBox {
  const x = index * PITCH;
  const y = ROW_Y - BOX_H / 2;
  const cx = x + BOX_W / 2;
  const cy = ROW_Y;
  return {
    id, x, y, w: BOX_W, h: BOX_H, cx, cy,
    ports: {
      top: { x: cx, y },
      right: { x: x + BOX_W, y: cy },
      bottom: { x: cx, y: y + BOX_H },
      left: { x, y: cy },
    },
    labelLines: [id],
    sublabelLines: [],
  };
}

export function straightEdge(id: string, from: NodeBox, to: NodeBox): EdgeGeom {
  const p0 = from.ports.right;
  const p1 = to.ports.left;
  return {
    id,
    points: [p0, p1],
    d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`,
    route: buildSegments([p0, p1]),
    arrowAt: p1,
    arrowAngle: 0,
    badgeAt: { x: (p0.x + p1.x) / 2, y: p0.y - 14 },
  };
}

/** ノード id の配列から一列のレイアウトを作る。エッジ id は「from + to」 */
export function lineLayout(nodeIds: string[], edges: DiagramEdge[]): ResolvedLayout {
  const nodes = new Map<string, NodeBox>();
  nodeIds.forEach((id, i) => nodes.set(id, lineBox(id, i)));
  const edgeMap = new Map<string, EdgeGeom>();
  for (const e of edges) {
    const from = nodes.get(e.from);
    const to = nodes.get(e.to);
    if (!from || !to) throw new Error(`fixture: エッジ ${e.id} の端点が無い`);
    edgeMap.set(e.id, straightEdge(e.id, from, to));
  }
  const width = nodeIds.length * PITCH;
  return {
    size: { width, height: 400 },
    title: { x: 0, y: 0, width, height: 60 },
    figure: { x: 0, y: 60, width, height: 280 },
    citation: { x: 0, y: 340, width, height: 60 },
    lanes: new Map([['main', { x: 0, y: 60, width, height: 280 }]]),
    groups: new Map(),
    nodes,
    edges: edgeMap,
    warnings: [],
  };
}

export const LINE_IDS = ['a', 'b', 'c', 'd', 'e'];

export const LINE_NODES: DiagramNode[] = LINE_IDS.map((id) => ({ id, kind: 'generic', label: id, lane: 'main' }));

export const LINE_EDGES: DiagramEdge[] = [
  { id: 'ab', from: 'a', to: 'b' },
  { id: 'bc', from: 'b', to: 'c' },
  { id: 'cd', from: 'c', to: 'd' },
  { id: 'de', from: 'd', to: 'e' },
];

/** 質問が a から e まで流れ、途中で文書と回答に変身する 3 ステップ */
export const LINE_STEPS: Step[] = [
  { n: 1, caption: '質問を送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
  { n: 2, caption: '文書を集める', actions: [{ type: 'travel', particle: 'q', edges: ['bc', 'cd'], payload: CHUNKS }] },
  {
    n: 3,
    caption: '回答を返す',
    actions: [
      { type: 'travel', particle: 'q', edges: ['de'], payload: ANSWER },
      { type: 'end', particle: 'q' },
    ],
  },
];

export function lineDiagram(steps: Step[] = LINE_STEPS, extra: Partial<Diagram> = {}): Diagram {
  return {
    id: 'line',
    title: '一列',
    lanes: [{ id: 'main' }],
    nodes: LINE_NODES,
    edges: LINE_EDGES,
    steps,
    sources: [],
    ...extra,
  };
}

export function lineFixture(steps: Step[] = LINE_STEPS, extra: Partial<Diagram> = {}) {
  const diagram = lineDiagram(steps, extra);
  return { diagram, layout: lineLayout(LINE_IDS, diagram.edges) };
}
