import type { Diagram, DiagramEdge, Side } from '../model/diagram';
import type {
  Cell, FrameAspect, GridGeom, LaneGeom, LayoutStyle, LayoutWarning, NodeBox, Pt, Rect, ResolvedLayout, Size,
} from './types';
import { maxLineWidth, wrapJa } from './measure';
import { routeEdges } from './route';
import { validateLayout } from './validate';

type DepthEdge = Pick<DiagramEdge, 'from' | 'to' | 'role'>;

/** 入力順を優先する Kahn のトポロジカルソート。サイクルがあれば null */
function topoOrder(nodeIds: string[], edges: DepthEdge[]): string[] | null {
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const id of nodeIds) {
    indeg.set(id, 0);
    succ.set(id, []);
  }
  for (const e of edges) {
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    succ.get(e.from)!.push(e.to);
  }
  const placed = new Set<string>();
  const order: string[] = [];
  while (order.length < nodeIds.length) {
    const next = nodeIds.find((id) => !placed.has(id) && indeg.get(id) === 0);
    if (!next) return null;
    placed.add(next);
    order.push(next);
    for (const s of succ.get(next) ?? []) indeg.set(s, indeg.get(s)! - 1);
  }
  return order;
}

/**
 * 最長路で列を割り当てる。サイクルがあれば loop 役のエッジを外し、それでも残れば入力順で前向きの辺だけ使う。
 * fixed に入っているノードはその列に固定し、後続はそこから数える。
 */
export function assignDepths(nodeIds: string[], edges: DepthEdge[], fixed?: Map<string, number>): Map<string, number> {
  const ids = new Set(nodeIds);
  let usable = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  let order = topoOrder(nodeIds, usable);
  if (!order) {
    usable = usable.filter((e) => e.role !== 'loop');
    order = topoOrder(nodeIds, usable);
  }
  if (!order) {
    const index = new Map(nodeIds.map((id, i) => [id, i] as const));
    usable = usable.filter((e) => index.get(e.from)! < index.get(e.to)!);
    order = nodeIds.slice();
  }
  const preds = new Map<string, string[]>();
  for (const e of usable) {
    if (!preds.has(e.to)) preds.set(e.to, []);
    preds.get(e.to)!.push(e.from);
  }
  const depth = new Map<string, number>();
  for (const id of order) {
    const pinned = fixed?.get(id);
    if (pinned !== undefined) {
      depth.set(id, pinned);
      continue;
    }
    let d = 0;
    for (const p of preds.get(id) ?? []) d = Math.max(d, (depth.get(p) ?? 0) + 1);
    depth.set(id, d);
  }
  return depth;
}

interface FrameSpec {
  size: Size;
  title: { y: number; height: number };
  figure: { y: number; height: number };
  caption: { y: number; height: number };
  citation: { y: number; height: number };
  /** 右端。9:16 は UI が被る x>960 を避ける */
  right: number;
}

const FRAME_MARGIN = 40;
const FREE_TITLE_HEIGHT = 96;
const FREE_CITATION_HEIGHT = 56;
const ICON_LABEL_GAP = 6;
const SUBLABEL_GAP = 2;
const LINE_HEIGHT = 1.4;
const GROUP_LABEL_HEIGHT = 1.6;

const FRAMES: Record<Exclude<FrameAspect, 'free'>, FrameSpec> = {
  '4:5': {
    size: { width: 1080, height: 1350 },
    title: { y: 64, height: 112 },
    figure: { y: 220, height: 790 },
    caption: { y: 1050, height: 180 },
    citation: { y: 1268, height: 44 },
    right: 1080,
  },
  '9:16': {
    size: { width: 1080, height: 1920 },
    title: { y: 274, height: 112 },
    figure: { y: 420, height: 890 },
    caption: { y: 1350, height: 210 },
    citation: { y: 1578, height: 44 },
    right: 960,
  },
  '1:1': {
    size: { width: 1080, height: 1080 },
    title: { y: 48, height: 96 },
    figure: { y: 180, height: 680 },
    caption: { y: 880, height: 120 },
    citation: { y: 1008, height: 44 },
    right: 1080,
  },
};

function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function expand(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 };
}

function shiftRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
}

function makePorts(cx: number, cy: number, w: number, h: number): Record<Side, Pt> {
  return {
    top: { x: cx, y: cy - h / 2 },
    right: { x: cx + w / 2, y: cy },
    bottom: { x: cx, y: cy + h / 2 },
    left: { x: cx - w / 2, y: cy },
  };
}

function placeNode(base: Omit<NodeBox, 'x' | 'y' | 'cx' | 'cy' | 'ports'>, cx: number, cy: number): NodeBox {
  return {
    ...base,
    x: cx - base.w / 2,
    y: cy - base.h / 2,
    cx,
    cy,
    ports: makePorts(cx, cy, base.w, base.h),
  };
}

interface Placement {
  lanes: Map<string, Rect>;
  laneGeoms: Map<string, LaneGeom>;
  nodes: Map<string, NodeBox>;
  groups: Map<string, Rect>;
  grid: GridGeom;
}

function shiftPlacement(p: Placement, dx: number, dy: number): Placement {
  const lanes = new Map<string, Rect>();
  for (const [id, r] of p.lanes) lanes.set(id, shiftRect(r, dx, dy));
  const laneGeoms = new Map<string, LaneGeom>();
  for (const [id, g] of p.laneGeoms) laneGeoms.set(id, { ...g, rect: shiftRect(g.rect, dx, dy) });
  const nodes = new Map<string, NodeBox>();
  for (const [id, n] of p.nodes) nodes.set(id, placeNode(n, n.cx + dx, n.cy + dy));
  const groups = new Map<string, Rect>();
  for (const [id, r] of p.groups) groups.set(id, shiftRect(r, dx, dy));
  return {
    lanes,
    laneGeoms,
    nodes,
    groups,
    grid: { ...p.grid, originX: p.grid.originX + dx, lanes: laneGeoms },
  };
}

/**
 * レーン × 列 × 行から座標を決め、配線し、投稿枠の中に置く。
 * emphasis や kind は見ない（スキンの仕事）。同じ入力には同じ結果を返す。
 */
export function resolveLayout(diagram: Diagram, style: LayoutStyle, frame: FrameAspect = 'free'): ResolvedLayout {
  const warnings: LayoutWarning[] = [];
  const hints = diagram.layout ?? {};
  // 投稿枠には枠自身の余白があるので、グリッドの余白は free 枠だけに付ける
  const pad = frame === 'free' ? (hints.padding ?? style.grid.padding) : 0;
  const laneGap = hints.laneGap ?? style.grid.laneGap;
  const laneOrder = diagram.lanes.map((l) => l.id);
  const laneSet = new Set(laneOrder);
  const fallbackLane = laneOrder[0] ?? '';

  const fixed = new Map<string, number>();
  for (const n of diagram.nodes) if (n.col !== undefined) fixed.set(n.id, n.col);
  const depths = assignDepths(diagram.nodes.map((n) => n.id), diagram.edges, fixed);

  const cells = new Map<string, Cell>();
  for (const n of diagram.nodes) {
    const lane = laneSet.has(n.lane) ? n.lane : fallbackLane;
    cells.set(n.id, { lane, col: n.col ?? depths.get(n.id) ?? 0, row: n.row ?? 0 });
  }

  const baseColWidth = hints.colWidth ?? style.grid.colWidth;
  const baseRowHeight = hints.rowHeight ?? style.grid.rowHeight;
  const channelRoom = style.stub * 2 + style.track * 2;
  const maxBoxW = Math.max(baseColWidth - channelRoom, style.nodeMin.sm.w);

  const sized = new Map<string, Omit<NodeBox, 'x' | 'y' | 'cx' | 'cy' | 'ports'>>();
  let maxW = 0;
  let maxH = 0;
  for (const n of diagram.nodes) {
    const min = style.nodeMin[n.size ?? 'md'];
    // 折り返しは最小幅を基準にする。箱を細く保ち、列の間に粒子とバッジの居場所を残すため
    const textMax = Math.min(min.w, Math.max(maxBoxW, min.w)) - style.nodePad * 2;
    const labelLines = wrapJa(n.label, textMax, style.measure, style.font.label);
    const sublabelLines = n.sublabel ? wrapJa(n.sublabel, textMax, style.measure, style.font.sublabel) : [];
    const textW = Math.max(
      maxLineWidth(labelLines, style.measure, style.font.label),
      maxLineWidth(sublabelLines, style.measure, style.font.sublabel),
    );
    const w = Math.min(Math.max(min.w, textW + style.nodePad * 2), Math.max(maxBoxW, min.w));
    let textH = labelLines.length * style.font.label.size * LINE_HEIGHT;
    if (sublabelLines.length > 0) textH += SUBLABEL_GAP + sublabelLines.length * style.font.sublabel.size * LINE_HEIGHT;
    const h = Math.max(min.h, style.nodePad * 2 + style.iconSize + ICON_LABEL_GAP + textH);
    sized.set(n.id, { id: n.id, w, h, labelLines, sublabelLines });
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);
  }
  const colWidth = Math.max(baseColWidth, maxW + channelRoom);
  const rowHeight = Math.max(baseRowHeight, maxH + channelRoom);

  let cols = 1;
  const rowsPerLane = new Map<string, number>();
  for (const id of laneOrder) rowsPerLane.set(id, 1);
  for (const c of cells.values()) {
    cols = Math.max(cols, c.col + 1);
    rowsPerLane.set(c.lane, Math.max(rowsPerLane.get(c.lane) ?? 1, c.row + 1));
  }

  const lanes = new Map<string, Rect>();
  const laneGeoms = new Map<string, LaneGeom>();
  let y = pad;
  for (const lane of diagram.lanes) {
    const header = lane.label ? style.grid.laneHeader : 0;
    const rows = rowsPerLane.get(lane.id) ?? 1;
    const rect = { x: pad, y, width: cols * colWidth, height: header + rows * rowHeight };
    lanes.set(lane.id, rect);
    laneGeoms.set(lane.id, { rect, header, rows });
    y += rect.height + laneGap;
  }

  const nodes = new Map<string, NodeBox>();
  for (const n of diagram.nodes) {
    const c = cells.get(n.id)!;
    const lane = laneGeoms.get(c.lane)!;
    const cx = n.at?.x ?? pad + colWidth * (c.col + 0.5);
    const cy = n.at?.y ?? lane.rect.y + lane.header + rowHeight * (c.row + 0.5);
    nodes.set(n.id, placeNode(sized.get(n.id)!, cx, cy));
  }

  const groups = new Map<string, Rect>();
  for (const g of diagram.groups ?? []) {
    let r: Rect | null = null;
    for (const id of g.nodes) {
      const n = nodes.get(id);
      if (!n) continue;
      r = unionRect(r, { x: n.x, y: n.y, width: n.w, height: n.h });
    }
    if (!r) continue;
    const rect = expand(r, style.nodePad);
    if (g.label) {
      const extra = style.font.sublabel.size * GROUP_LABEL_HEIGHT;
      rect.y -= extra;
      rect.height += extra;
    }
    groups.set(g.id, rect);
  }

  let placement: Placement = {
    lanes,
    laneGeoms,
    nodes,
    groups,
    grid: { originX: pad, colWidth, rowHeight, laneGap, cols, laneOrder, lanes: laneGeoms, cells },
  };

  const draft = routeEdges(diagram, placement.nodes, placement.lanes, style, placement.grid);
  let content: Rect | null = null;
  for (const r of placement.lanes.values()) content = unionRect(content, r);
  for (const n of placement.nodes.values()) content = unionRect(content, { x: n.x, y: n.y, width: n.w, height: n.h });
  for (const r of placement.groups.values()) content = unionRect(content, r);
  for (const e of draft.values()) {
    for (const p of e.points) content = unionRect(content, { x: p.x, y: p.y, width: 0, height: 0 });
    if (e.label) content = unionRect(content, e.label.box);
  }
  const natural = expand(content ?? { x: pad, y: pad, width: 0, height: 0 }, pad);

  let size: Size;
  let title: Rect;
  let figure: Rect;
  let caption: Rect | undefined;
  let citation: Rect;
  if (frame === 'free') {
    size = { width: natural.width, height: FREE_TITLE_HEIGHT + natural.height + FREE_CITATION_HEIGHT };
    title = { x: 0, y: 0, width: natural.width, height: FREE_TITLE_HEIGHT };
    figure = { x: 0, y: FREE_TITLE_HEIGHT, width: natural.width, height: natural.height };
    citation = { x: 0, y: FREE_TITLE_HEIGHT + natural.height, width: natural.width, height: FREE_CITATION_HEIGHT };
  } else {
    const spec = FRAMES[frame];
    const x = FRAME_MARGIN;
    const width = spec.right - FRAME_MARGIN * 2;
    size = spec.size;
    title = { x, width, ...spec.title };
    figure = { x, width, ...spec.figure };
    caption = { x, width, ...spec.caption };
    citation = { x, width, ...spec.citation };
    if (natural.width > figure.width + 0.5 || natural.height > figure.height + 0.5) {
      warnings.push({
        kind: 'figure-overflow',
        ids: [diagram.id],
        message: `図 ${Math.round(natural.width)}×${Math.round(natural.height)} が枠 ${figure.width}×${figure.height} に収まらない`,
      });
    }
  }

  const dx = Math.round(figure.x + (figure.width - natural.width) / 2 - natural.x);
  const dy = Math.round(figure.y + (figure.height - natural.height) / 2 - natural.y);
  placement = shiftPlacement(placement, dx, dy);
  const edges = routeEdges(diagram, placement.nodes, placement.lanes, style, placement.grid);

  const layout: ResolvedLayout = {
    size,
    title,
    figure,
    caption,
    citation,
    lanes: placement.lanes,
    groups: placement.groups,
    nodes: placement.nodes,
    edges,
    warnings,
  };
  warnings.push(...validateLayout(layout, diagram));
  return layout;
}
