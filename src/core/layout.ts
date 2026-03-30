/**
 * Automatic layout engine for flow diagrams.
 * Pure algorithm module — no project imports needed.
 */

// ── Types ──

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export type PositionMap = Map<string, { x: number; y: number }>;

type AdjList = Map<string, string[]>;

const MIN_GAP = 80;

// ── Graph helpers ──

function buildAdj(edges: LayoutEdge[]): { fwd: AdjList; rev: AdjList; allIds: Set<string> } {
  const fwd: AdjList = new Map();
  const rev: AdjList = new Map();
  const allIds = new Set<string>();
  for (const e of edges) {
    allIds.add(e.from);
    allIds.add(e.to);
    if (!fwd.has(e.from)) fwd.set(e.from, []);
    fwd.get(e.from)!.push(e.to);
    if (!rev.has(e.to)) rev.set(e.to, []);
    rev.get(e.to)!.push(e.from);
  }
  return { fwd, rev, allIds };
}

/** Kahn's topological sort. Returns null if cycle detected. */
function topoSort(nodeIds: string[], edges: LayoutEdge[]): string[] | null {
  const { fwd, rev, allIds } = buildAdj(edges);
  // Include nodes without edges
  for (const id of nodeIds) allIds.add(id);

  const inDeg = new Map<string, number>();
  for (const id of allIds) inDeg.set(id, 0);
  for (const e of edges) {
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const id of allIds) {
    if (inDeg.get(id) === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    queue.sort(); // deterministic order
    const node = queue.shift()!;
    result.push(node);
    for (const next of fwd.get(node) ?? []) {
      const d = inDeg.get(next)! - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  return result.length === allIds.size ? result : null;
}

/** Detect back-edges (cycles) by DFS coloring. */
function hasCycle(nodeIds: string[], edges: LayoutEdge[]): boolean {
  const { fwd, allIds } = buildAdj(edges);
  for (const id of nodeIds) allIds.add(id);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of allIds) color.set(id, WHITE);

  function dfs(u: string): boolean {
    color.set(u, GRAY);
    for (const v of fwd.get(u) ?? []) {
      if (color.get(v) === GRAY) return true;
      if (color.get(v) === WHITE && dfs(v)) return true;
    }
    color.set(u, BLACK);
    return false;
  }

  for (const id of allIds) {
    if (color.get(id) === WHITE && dfs(id)) return true;
  }
  return false;
}

/** Check if graph has parallel branches (fan-out where out-degree > 1). */
function hasParallelBranches(edges: LayoutEdge[]): boolean {
  const outDeg = new Map<string, number>();
  for (const e of edges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
  }
  for (const d of outDeg.values()) {
    if (d > 1) return true;
  }
  return false;
}

/**
 * Assign each node a "depth" (column) based on longest path from a root.
 * Nodes at the same depth are parallel and can share a column/row.
 */
function assignDepths(nodeIds: string[], edges: LayoutEdge[]): Map<string, number> {
  const sorted = topoSort(nodeIds, edges);
  const order = sorted ?? nodeIds;
  const { fwd, rev } = buildAdj(edges);

  const depth = new Map<string, number>();
  for (const id of order) depth.set(id, 0);

  // Longest-path layering
  for (const id of order) {
    const d = depth.get(id)!;
    for (const next of fwd.get(id) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, d + 1));
    }
  }

  return depth;
}

/**
 * Group nodes by depth, returning layers in order.
 */
function groupByDepth(nodeIds: string[], edges: LayoutEdge[]): string[][] {
  const depth = assignDepths(nodeIds, edges);
  const maxDepth = Math.max(0, ...depth.values());
  const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const id of nodeIds) {
    layers[depth.get(id) ?? 0].push(id);
  }
  // Include any edge-only nodes not in nodeIds
  for (const [id, d] of depth) {
    if (!nodeIds.includes(id)) layers[d].push(id);
  }
  return layers;
}

// ── Layout strategies ──

/**
 * Zigzag layout for linear/branching flows (3-6 nodes).
 * Left-to-right on odd rows, right-to-left on even rows (Z-shape).
 */
export function layoutZigzag(
  nodeIds: string[],
  edges: LayoutEdge[],
  bbox: BBox,
): PositionMap {
  const sorted = topoSort(nodeIds, edges) ?? nodeIds;
  const n = sorted.length;
  if (n === 0) return new Map();

  // 3ノード以下→1行、4-6→3列でZ字、7+→4列
  const colsPerRow = n <= 3 ? n : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / colsPerRow);

  const colStep = bbox.width / (colsPerRow + 1);
  const rowStep = bbox.height / (rows + 1);

  // Enforce minimum gap
  const effectiveColStep = Math.max(colStep, MIN_GAP);
  const effectiveRowStep = Math.max(rowStep, MIN_GAP);

  const positions: PositionMap = new Map();

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / colsPerRow);
    const colIndex = i % colsPerRow;
    // Alternate direction per row
    const col = row % 2 === 0 ? colIndex : colsPerRow - 1 - colIndex;

    const x = bbox.x + effectiveColStep * (col + 1);
    const y = bbox.y + effectiveRowStep * (row + 1);
    positions.set(sorted[i], { x, y });
  }

  return positions;
}

/**
 * Grid layout for flows with parallel branches.
 * Columns = depth stages, rows = parallel nodes at each stage.
 */
export function layoutGrid(
  nodeIds: string[],
  edges: LayoutEdge[],
  bbox: BBox,
): PositionMap {
  const layers = groupByDepth(nodeIds, edges);
  const numCols = layers.length;
  if (numCols === 0) return new Map();

  const maxRowCount = Math.max(1, ...layers.map((l) => l.length));
  const colStep = Math.max(MIN_GAP, bbox.width / (numCols + 1));
  const rowStep = Math.max(MIN_GAP, bbox.height / (maxRowCount + 1));

  const positions: PositionMap = new Map();

  for (let col = 0; col < numCols; col++) {
    const layer = layers[col];
    const layerRowStep = Math.max(MIN_GAP, bbox.height / (layer.length + 1));

    for (let row = 0; row < layer.length; row++) {
      const x = bbox.x + colStep * (col + 1);
      const y = bbox.y + layerRowStep * (row + 1);
      positions.set(layer[row], { x, y });
    }
  }

  return positions;
}

/**
 * Circular layout for cyclic/feedback flows.
 * Nodes placed around an ellipse filling the canvas.
 */
export function layoutCircular(
  nodeIds: string[],
  edges: LayoutEdge[],
  bbox: BBox,
): PositionMap {
  const n = nodeIds.length;
  if (n === 0) return new Map();

  // Try topological order for consistent ordering; fall back to given order
  const sorted = topoSort(nodeIds, edges) ?? nodeIds;

  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const rx = (bbox.width / 2) * 0.8; // 80% of half-width for padding
  const ry = (bbox.height / 2) * 0.8;

  const positions: PositionMap = new Map();

  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n; // start from top
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    positions.set(sorted[i], { x, y });
  }

  return positions;
}

/**
 * Auto-select the best layout strategy based on flow structure.
 * - Has back-edges (cycles) → circular
 * - Has parallel branches (fan-out) → grid
 * - Otherwise (linear) → zigzag
 */
export function autoLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  bbox: BBox,
): PositionMap {
  if (hasCycle(nodeIds, edges)) {
    return layoutCircular(nodeIds, edges, bbox);
  }
  if (hasParallelBranches(edges)) {
    return layoutGrid(nodeIds, edges, bbox);
  }
  return layoutZigzag(nodeIds, edges, bbox);
}
