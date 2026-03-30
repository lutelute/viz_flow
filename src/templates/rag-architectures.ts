import type { FlowDefinition, FlowNode, FlowEdge, FlowZone } from '../core/types';
import { autoLayout } from '../core/layout';

const C = {
  base: '#94a3b8',
  hi1: '#6366f1', hi2: '#ec4899', hi3: '#f59e0b',
  hi4: '#10b981', hi5: '#ef4444', hi6: '#14b8a6', hi7: '#f97316',
};

const W = 440;
const H = 260;
// タイトル領域: y=0〜55, ノード領域: y=55〜H-10
const BBOX = { x: 20, y: 60, width: W - 40, height: H - 75 };

/** ノード定義(座標なし) → autoLayout で座標を自動計算 → FlowNode[] を返す */
function applyLayout(
  defs: Omit<FlowNode, 'x' | 'y'>[],
  edges: FlowEdge[],
): FlowNode[] {
  const ids = defs.map(d => d.id);
  const layoutEdges = edges.map(e => ({ from: e.from, to: e.to }));
  const positions = autoLayout(ids, layoutEdges, BBOX);
  return defs.map(d => {
    const pos = positions.get(d.id) ?? { x: BBOX.x + BBOX.width / 2, y: BBOX.y + BBOX.height / 2 };
    return { ...d, x: Math.round(pos.x), y: Math.round(pos.y) } as FlowNode;
  });
}

function cfg(title: string, sub: string): FlowDefinition['config'] {
  return { title, subtitle: sub, width: W, height: H, theme: 'light', animationSpeed: 1, showLabels: true };
}

// ── 共通ベースノード（座標なし）──
function baseNodeDefs(): Omit<FlowNode, 'x' | 'y'>[] {
  return [
    { id: 'query',  label: 'Query',  icon: 'user',     color: C.base, width: 24, muted: true },
    { id: 'llm',    label: 'LLM',    icon: 'sparkles', color: C.base, width: 26, muted: true },
    { id: 'output', label: 'Output', icon: 'mail',     color: C.base, width: 20, muted: true },
  ];
}

function baseEdge(): FlowEdge {
  return { id: 'c1', from: 'llm', to: 'output', delay: 6 };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Naive RAG — 直線、全ノードカラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const naiveNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  { id: 'query',  label: 'Query',     icon: 'user',     color: C.hi1, width: 24 },
  { id: 'embed',  label: 'Embed',     icon: 'cpu',      color: C.hi1, width: 22 },
  { id: 'vecdb',  label: 'Vector DB', icon: 'database', color: C.hi1, width: 24 },
  { id: 'llm',    label: 'LLM',       icon: 'sparkles', color: C.hi1, width: 26 },
  { id: 'output', label: 'Output',    icon: 'mail',     color: C.hi1, width: 20 },
];
const naiveEdges: FlowEdge[] = [
  { id: 'e1', from: 'query', to: 'embed', delay: 0 },
  { id: 'e2', from: 'embed', to: 'vecdb', delay: 1.5 },
  { id: 'e3', from: 'vecdb', to: 'llm',   delay: 3 },
  { id: 'e5', from: 'llm',   to: 'output', delay: 5 },
];
export const naiveRag: FlowDefinition = {
  nodes: applyLayout(naiveNodeDefs, naiveEdges),
  edges: naiveEdges,
  config: cfg('Naive RAG', 'Linear — the baseline'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Multimodal RAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const multiNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'text',  label: 'Text',  icon: 'file-input', color: C.hi1, width: 20 },
  { id: 'img',   label: 'Image', icon: 'eye',        color: C.hi2, width: 20 },
  { id: 'embed', label: 'Embed', icon: 'cpu',        color: C.hi1, width: 22 },
  { id: 'vecdb', label: 'VecDB', icon: 'database',   color: C.base, width: 22, muted: true },
];
const multiEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'text',  to: 'embed', delay: 0, color: C.hi1 },
  { id: 'h2', from: 'img',   to: 'embed', delay: 0.3, color: C.hi2 },
  { id: 'h3', from: 'embed', to: 'vecdb', delay: 1.5 },
  { id: 'h4', from: 'vecdb', to: 'llm',   delay: 3 },
  { id: 'h5', from: 'query', to: 'llm',   delay: 0.5, dashed: true },
];
export const multimodalRag: FlowDefinition = {
  nodes: applyLayout(multiNodeDefs, multiEdges),
  edges: multiEdges,
  config: cfg('Multimodal RAG', '+ multi-modal input'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. HyDE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const hydeNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'hypo',  label: 'Hypothesis', icon: 'lightbulb', color: C.hi3, width: 22 },
  { id: 'embed', label: 'Embed',      icon: 'cpu',       color: C.base, width: 20, muted: true },
  { id: 'vecdb', label: 'VecDB',      icon: 'database',  color: C.base, width: 22, muted: true },
];
const hydeEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'query', to: 'hypo',  delay: 0, color: C.hi3 },
  { id: 'h2', from: 'hypo',  to: 'embed', delay: 1.5, color: C.hi3 },
  { id: 'h3', from: 'embed', to: 'vecdb', delay: 3 },
  { id: 'h4', from: 'vecdb', to: 'llm',   delay: 4.5 },
];
export const hydeRag: FlowDefinition = {
  nodes: applyLayout(hydeNodeDefs, hydeEdges),
  edges: hydeEdges,
  config: cfg('HyDE RAG', '+ hypothetical doc before embed'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. Corrective RAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const corrNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'embed', label: 'Embed', icon: 'cpu',      color: C.base, width: 20, muted: true },
  { id: 'vecdb', label: 'VecDB', icon: 'database', color: C.base, width: 22, muted: true },
  { id: 'eval',  label: 'Check', icon: 'target',   color: C.hi5, width: 22 },
  { id: 'web',   label: 'Web',   icon: 'globe',    color: C.hi3, width: 20 },
];
const corrEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'query', to: 'embed', delay: 0 },
  { id: 'h2', from: 'embed', to: 'vecdb', delay: 1.5 },
  { id: 'h3', from: 'vecdb', to: 'eval',  delay: 3, color: C.hi5 },
  { id: 'h4', from: 'eval',  to: 'llm',   delay: 4.5, color: C.hi4 },
  { id: 'h5', from: 'eval',  to: 'web',   delay: 4.5, color: C.hi5, dashed: true },
  { id: 'h6', from: 'web',   to: 'llm',   delay: 5.5, color: C.hi3 },
];
export const correctiveRag: FlowDefinition = {
  nodes: applyLayout(corrNodeDefs, corrEdges),
  edges: corrEdges,
  config: cfg('Corrective RAG', '+ relevance check → fallback'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. Graph RAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const graphNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'extract',  label: 'Extract',  icon: 'search',  color: C.hi6, width: 20 },
  { id: 'kg',       label: 'GraphDB',  icon: 'git',     color: C.hi6, width: 24 },
  { id: 'traverse', label: 'Traverse', icon: 'shuffle', color: C.hi6, width: 20 },
];
const graphEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'query',    to: 'extract',  delay: 0, color: C.hi6 },
  { id: 'h2', from: 'extract',  to: 'kg',       delay: 1.5, color: C.hi6 },
  { id: 'h3', from: 'query',    to: 'traverse',  delay: 0.5, dashed: true },
  { id: 'h4', from: 'kg',       to: 'traverse',  delay: 3, color: C.hi6 },
  { id: 'h5', from: 'traverse', to: 'llm',       delay: 4.5, color: C.hi6 },
];
export const graphRag: FlowDefinition = {
  nodes: applyLayout(graphNodeDefs, graphEdges),
  edges: graphEdges,
  config: cfg('Graph RAG', '+ knowledge graph traversal'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. Hybrid RAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const hybridNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'dense',  label: 'Dense',   icon: 'database', color: C.hi1, width: 20 },
  { id: 'sparse', label: 'Sparse',  icon: 'search',   color: C.hi3, width: 20 },
  { id: 'rerank', label: 'Re-rank', icon: 'filter',   color: C.hi2, width: 22 },
];
const hybridEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'query',  to: 'dense',  delay: 0, color: C.hi1 },
  { id: 'h2', from: 'query',  to: 'sparse', delay: 0, color: C.hi3 },
  { id: 'h3', from: 'dense',  to: 'rerank', delay: 1.5, color: C.hi1 },
  { id: 'h4', from: 'sparse', to: 'rerank', delay: 1.5, color: C.hi3 },
  { id: 'h5', from: 'rerank', to: 'llm',    delay: 3, color: C.hi2 },
];
export const hybridRag: FlowDefinition = {
  nodes: applyLayout(hybridNodeDefs, hybridEdges),
  edges: hybridEdges,
  config: cfg('Hybrid RAG', '+ dense + sparse → re-rank'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. Adaptive RAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const adaptNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'router', label: 'Router', icon: 'shuffle',  color: C.hi7, width: 22 },
  { id: 'rag',    label: 'RAG',    icon: 'database', color: C.base, width: 18, muted: true },
  { id: 'web',    label: 'Web',    icon: 'globe',    color: C.hi3, width: 18 },
  { id: 'direct', label: 'Direct', icon: 'zap',      color: C.hi7, width: 18 },
];
const adaptEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'query',  to: 'router', delay: 0, color: C.hi7 },
  { id: 'h2', from: 'router', to: 'rag',    delay: 1.5 },
  { id: 'h3', from: 'router', to: 'web',    delay: 1.5, color: C.hi3 },
  { id: 'h4', from: 'router', to: 'direct', delay: 1.5, color: C.hi7 },
  { id: 'h5', from: 'rag',    to: 'llm',    delay: 3 },
  { id: 'h6', from: 'web',    to: 'llm',    delay: 3, color: C.hi3 },
  { id: 'h7', from: 'direct', to: 'llm',    delay: 3, color: C.hi7 },
];
export const adaptiveRag: FlowDefinition = {
  nodes: applyLayout(adaptNodeDefs, adaptEdges),
  edges: adaptEdges,
  config: cfg('Adaptive RAG', '+ router → multiple paths'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. Agentic RAG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const agentNodeDefs: Omit<FlowNode, 'x' | 'y'>[] = [
  ...baseNodeDefs(),
  { id: 'planner', label: 'Plan',  icon: 'lightbulb', color: C.hi7, width: 22 },
  { id: 'tool1',   label: 'RAG',   icon: 'search',    color: C.hi1, width: 18 },
  { id: 'tool2',   label: 'Web',   icon: 'globe',     color: C.hi3, width: 18 },
  { id: 'tool3',   label: 'Code',  icon: 'code',      color: C.hi6, width: 18 },
  { id: 'merge',   label: 'Merge', icon: 'layers',    color: C.hi7, width: 18 },
];
const agentEdges: FlowEdge[] = [
  baseEdge(),
  { id: 'h1', from: 'query',   to: 'planner', delay: 0, color: C.hi7 },
  { id: 'h2', from: 'planner', to: 'tool1',   delay: 1.5, color: C.hi1 },
  { id: 'h3', from: 'planner', to: 'tool2',   delay: 1.5, color: C.hi3 },
  { id: 'h4', from: 'planner', to: 'tool3',   delay: 1.5, color: C.hi6 },
  { id: 'h5', from: 'tool1',   to: 'merge',   delay: 3, color: C.hi1 },
  { id: 'h6', from: 'tool2',   to: 'merge',   delay: 3, color: C.hi3 },
  { id: 'h7', from: 'tool3',   to: 'merge',   delay: 3, color: C.hi6 },
  { id: 'h8', from: 'merge',   to: 'llm',     delay: 4.5, color: C.hi7 },
];
export const agenticRag: FlowDefinition = {
  nodes: applyLayout(agentNodeDefs, agentEdges),
  edges: agentEdges,
  config: cfg('Agentic RAG', '+ planner + tools'),
};

export const ragArchitectures = [
  { name: 'Naive',      key: 'naive-rag',      flow: naiveRag },
  { name: 'Multimodal', key: 'multimodal-rag', flow: multimodalRag },
  { name: 'HyDE',       key: 'hyde-rag',       flow: hydeRag },
  { name: 'Corrective', key: 'corrective-rag', flow: correctiveRag },
  { name: 'Graph',      key: 'graph-rag',      flow: graphRag },
  { name: 'Hybrid',     key: 'hybrid-rag',     flow: hybridRag },
  { name: 'Adaptive',   key: 'adaptive-rag',   flow: adaptiveRag },
  { name: 'Agentic',    key: 'agentic-rag',    flow: agenticRag },
];
