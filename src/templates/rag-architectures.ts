import type { FlowDefinition, FlowNode, FlowEdge, FlowZone, ParticleGroup } from '../core/types';

const C = {
  base: '#94a3b8',
  hi1: '#6366f1', hi2: '#ec4899', hi3: '#f59e0b',
  hi4: '#10b981', hi5: '#ef4444', hi6: '#14b8a6', hi7: '#f97316',
};

// カードサイズ
const W = 460;
const H = 270;

// 共通3点の固定座標 — 全RAGで同じ位置
const Q  = { x: 50,  y: 100 };  // Query: 左
const LM = { x: 360, y: 200 };  // LLM: 右下
const OT = { x: 420, y: 200 };  // Output: LLMの右隣

function cfg(title: string, sub: string): FlowDefinition['config'] {
  return { title, subtitle: sub, width: W, height: H, theme: 'light', animationSpeed: 1, showLabels: true, particleMode: 'js' };
}

// 共通ベースノード
function base(): FlowNode[] {
  return [
    { id: 'query',  label: 'Query',  ...Q,  icon: 'user',     color: C.base, width: 24, muted: true },
    { id: 'llm',    label: 'LLM',    ...LM, icon: 'sparkles', color: C.base, width: 26, muted: true },
    { id: 'output', label: 'Output', ...OT, icon: 'mail',     color: C.base, width: 20, muted: true },
  ];
}

function baseEdges(): FlowEdge[] {
  return [
    { id: 'b1', from: 'llm', to: 'output' },
  ];
}

// 共通パーティクル: LLM→Output
function baseBall(): ParticleGroup['balls'][0] {
  return { waypoints: ['llm', 'output'], color: C.base, delay: 5, travel: 1 };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Naive RAG — Z字配置、全ノードカラー
//    Query → Embed → VecDB (上段左→右)
//    LLM ← ← ← ← ← ← ← (下段右→左)
//    Output (右上)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const naiveRag: FlowDefinition = {
  nodes: [
    { id: 'query',  label: 'Query',     ...Q,              icon: 'user',     color: C.hi1, width: 24 },
    { id: 'embed',  label: 'Embed',     x: 160, y: 100,  icon: 'cpu',      color: C.hi1, width: 22 },
    { id: 'vecdb',  label: 'Vector DB', x: 270, y: 100,  icon: 'database', color: C.hi1, width: 24 },
    { id: 'llm',    label: 'LLM',       ...LM,            icon: 'sparkles', color: C.hi1, width: 26 },
    { id: 'output', label: 'Output',    ...OT,            icon: 'mail',     color: C.hi1, width: 20 },
  ],
  edges: [
    { id: 'e1', from: 'query', to: 'embed' },
    { id: 'e2', from: 'embed', to: 'vecdb' },
    { id: 'e3', from: 'vecdb', to: 'llm' },
    { id: 'e4', from: 'llm',   to: 'output' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      { waypoints: ['query', 'embed', 'vecdb', 'llm', 'output'], color: C.hi1, label: 'data', travel: 4 },
    ],
  }],
  config: cfg('Naive RAG', 'Linear — the baseline'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Multimodal RAG — 左に2入力が分岐してEmbedに合流
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const multimodalRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'text',  label: 'Text',  x: 50,  y: 70,  icon: 'file-input', color: C.hi1, width: 20 },
    { id: 'img',   label: 'Image', x: 50,  y: 150, icon: 'eye',        color: C.hi2, width: 20 },
    { id: 'embed', label: 'Embed', x: 170, y: 110, icon: 'cpu',        color: C.hi1, width: 22 },
    { id: 'vecdb', label: 'VecDB', x: 290, y: 110, icon: 'database',   color: C.base, width: 22, muted: true },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'text', to: 'embed', color: C.hi1 },
    { id: 'h2', from: 'img',  to: 'embed', color: C.hi2 },
    { id: 'h3', from: 'embed', to: 'vecdb' },
    { id: 'h4', from: 'vecdb', to: 'llm' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      { waypoints: ['text', 'embed', 'vecdb', 'llm'], color: C.hi1, label: 'txt', delay: 0, travel: 2.5 },
      { waypoints: ['img', 'embed', 'vecdb', 'llm'],  color: C.hi2, label: 'img', delay: 0.5, travel: 2.5 },
      baseBall(),
    ],
  }],
  config: cfg('Multimodal RAG', '+ multi-modal input'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. HyDE — U字: Query→Hypo(左下)→Embed(中央下)→VecDB(右)→LLM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const hydeRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'hypo',  label: 'Hypothesis', x: 130, y: 160, icon: 'lightbulb', color: C.hi3, width: 24 },
    { id: 'embed', label: 'Embed',      x: 250, y: 210, icon: 'cpu',       color: C.base, width: 20, muted: true },
    { id: 'vecdb', label: 'VecDB',      x: 350, y: 130, icon: 'database',  color: C.base, width: 22, muted: true },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'query', to: 'hypo',  color: C.hi3 },
    { id: 'h2', from: 'hypo',  to: 'embed', color: C.hi3 },
    { id: 'h3', from: 'embed', to: 'vecdb' },
    { id: 'h4', from: 'vecdb', to: 'llm' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      { waypoints: ['query', 'hypo', 'embed', 'vecdb', 'llm'], color: C.hi3, label: 'hypo', travel: 3.5 },
      baseBall(),
    ],
  }],
  config: cfg('HyDE RAG', '+ hypothetical doc before embed'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. Corrective RAG — 中央に評価ゲート、下段にWebフォールバック
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const correctiveRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'embed', label: 'Embed', x: 150, y: 100,  icon: 'cpu',      color: C.base, width: 20, muted: true },
    { id: 'vecdb', label: 'VecDB', x: 250, y: 100,  icon: 'database', color: C.base, width: 22, muted: true },
    { id: 'eval',  label: 'Check', x: 350, y: 100,  icon: 'target',   color: C.hi5, width: 24 },
    { id: 'web',   label: 'Web',   x: 200, y: 200, icon: 'globe',    color: C.hi3, width: 22 },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'query', to: 'embed' },
    { id: 'h2', from: 'embed', to: 'vecdb' },
    { id: 'h3', from: 'vecdb', to: 'eval', color: C.hi5 },
    { id: 'h4', from: 'eval',  to: 'llm', color: C.hi4 },
    { id: 'h5', from: 'eval',  to: 'web', color: C.hi5, dashed: true },
    { id: 'h6', from: 'web',   to: 'llm', color: C.hi3 },
  ],
  zones: [
    { id: 'z1', label: 'CORRECTION', x: 160, y: 175, width: 230, height: 65, color: C.hi5, dashed: true },
  ],
  particleGroups: [{
    id: 'pass', pauseDuration: 2.5,
    balls: [
      { waypoints: ['query', 'embed', 'vecdb', 'eval'], color: C.base, delay: 0, travel: 2 },
      { waypoints: ['eval', 'llm'], color: C.hi4, label: 'ok', delay: 2.5, travel: 1 },
      { waypoints: ['eval', 'web', 'llm'], color: C.hi5, label: 'ng', delay: 2.5, travel: 2 },
      baseBall(),
    ],
  }],
  config: cfg('Corrective RAG', '+ relevance check → fallback'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. Graph RAG — 左→中央上にExtract/KG、中央下にTraverse
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const graphRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'extract',  label: 'Extract',  x: 160, y: 100,  icon: 'search',  color: C.hi6, width: 22 },
    { id: 'kg',       label: 'GraphDB',  x: 280, y: 100,  icon: 'git',     color: C.hi6, width: 26 },
    { id: 'traverse', label: 'Traverse', x: 220, y: 190, icon: 'shuffle', color: C.hi6, width: 22 },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'query',    to: 'extract', color: C.hi6 },
    { id: 'h2', from: 'extract',  to: 'kg', color: C.hi6 },
    { id: 'h3', from: 'kg',       to: 'traverse', color: C.hi6 },
    { id: 'h4', from: 'query',    to: 'traverse', dashed: true },
    { id: 'h5', from: 'traverse', to: 'llm', color: C.hi6 },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      { waypoints: ['query', 'extract', 'kg', 'traverse', 'llm'], color: C.hi6, label: 'entity', travel: 3.5 },
      baseBall(),
    ],
  }],
  config: cfg('Graph RAG', '+ knowledge graph traversal'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. Hybrid RAG — 中央に2つの検索が縦に展開、Re-rankで合流
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const hybridRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'dense',  label: 'Dense',   x: 160, y: 80,  icon: 'database', color: C.hi1, width: 22 },
    { id: 'sparse', label: 'Sparse',  x: 160, y: 180, icon: 'search',   color: C.hi3, width: 22 },
    { id: 'rerank', label: 'Re-rank', x: 290, y: 130, icon: 'filter',   color: C.hi2, width: 24 },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'query',  to: 'dense', color: C.hi1 },
    { id: 'h2', from: 'query',  to: 'sparse', color: C.hi3 },
    { id: 'h3', from: 'dense',  to: 'rerank', color: C.hi1 },
    { id: 'h4', from: 'sparse', to: 'rerank', color: C.hi3 },
    { id: 'h5', from: 'rerank', to: 'llm', color: C.hi2 },
  ],
  zones: [
    { id: 'z1', label: 'DUAL SEARCH', x: 120, y: 60, width: 90, height: 170, color: C.hi2, dashed: true },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      { waypoints: ['query', 'dense', 'rerank'],  color: C.hi1, delay: 0, travel: 1.8 },
      { waypoints: ['query', 'sparse', 'rerank'], color: C.hi3, delay: 0, travel: 1.8 },
      { waypoints: ['rerank', 'llm'], color: C.hi2, delay: 2.2, travel: 1.5 },
      baseBall(),
    ],
  }],
  config: cfg('Hybrid RAG', '+ dense + sparse → re-rank'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. Adaptive RAG — Routerから3方向に分岐（縦展開）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const adaptiveRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'router', label: 'Router', x: 160, y: 140, icon: 'shuffle', color: C.hi7, width: 24 },
    { id: 'rag',    label: 'RAG',    x: 290, y: 80,  icon: 'database', color: C.base, width: 20, muted: true },
    { id: 'web',    label: 'Web',    x: 290, y: 145, icon: 'globe',    color: C.hi3, width: 20 },
    { id: 'direct', label: 'Direct', x: 290, y: 210, icon: 'zap',      color: C.hi7, width: 20 },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'query',  to: 'router', color: C.hi7 },
    { id: 'h2', from: 'router', to: 'rag' },
    { id: 'h3', from: 'router', to: 'web', color: C.hi3 },
    { id: 'h4', from: 'router', to: 'direct', color: C.hi7 },
    { id: 'h5', from: 'rag',    to: 'llm' },
    { id: 'h6', from: 'web',    to: 'llm', color: C.hi3 },
    { id: 'h7', from: 'direct', to: 'llm', color: C.hi7 },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      { waypoints: ['query', 'router'], color: C.hi7, delay: 0, travel: 1 },
      { waypoints: ['router', 'rag', 'llm'],    color: C.base, delay: 1.2, travel: 2 },
      { waypoints: ['router', 'web', 'llm'],    color: C.hi3,  delay: 1.2, travel: 2 },
      { waypoints: ['router', 'direct', 'llm'], color: C.hi7,  delay: 1.2, travel: 2 },
      baseBall(),
    ],
  }],
  config: cfg('Adaptive RAG', '+ router → multiple paths'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. Agentic RAG — Planner→3ツール→Merge→LLM（最も複雑）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const agenticRag: FlowDefinition = {
  nodes: [
    ...base(),
    { id: 'planner', label: 'Plan',  x: 140, y: 140, icon: 'lightbulb', color: C.hi7, width: 24 },
    { id: 'tool1',   label: 'RAG',   x: 250, y: 80,  icon: 'search',    color: C.hi1, width: 20 },
    { id: 'tool2',   label: 'Web',   x: 250, y: 145, icon: 'globe',     color: C.hi3, width: 20 },
    { id: 'tool3',   label: 'Code',  x: 250, y: 210, icon: 'code',      color: C.hi6, width: 20 },
    { id: 'merge',   label: 'Merge', x: 350, y: 140, icon: 'layers',    color: C.hi7, width: 20 },
  ],
  edges: [
    ...baseEdges(),
    { id: 'h1', from: 'query',   to: 'planner', color: C.hi7 },
    { id: 'h2', from: 'planner', to: 'tool1', color: C.hi1 },
    { id: 'h3', from: 'planner', to: 'tool2', color: C.hi3 },
    { id: 'h4', from: 'planner', to: 'tool3', color: C.hi6 },
    { id: 'h5', from: 'tool1',   to: 'merge', color: C.hi1 },
    { id: 'h6', from: 'tool2',   to: 'merge', color: C.hi3 },
    { id: 'h7', from: 'tool3',   to: 'merge', color: C.hi6 },
    { id: 'h8', from: 'merge',   to: 'llm', color: C.hi7 },
  ],
  zones: [
    { id: 'z1', label: 'TOOLS', x: 215, y: 60, width: 75, height: 190, color: C.hi7, dashed: true },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2,
    balls: [
      { waypoints: ['query', 'planner'], color: C.hi7, delay: 0, travel: 1 },
      { waypoints: ['planner', 'tool1', 'merge'], color: C.hi1, delay: 1.2, travel: 1.5 },
      { waypoints: ['planner', 'tool2', 'merge'], color: C.hi3, delay: 1.5, travel: 1.5 },
      { waypoints: ['planner', 'tool3', 'merge'], color: C.hi6, delay: 1.8, travel: 1.5 },
      { waypoints: ['merge', 'llm'], color: C.hi7, label: 'merged', delay: 3.5, travel: 1 },
      baseBall(),
    ],
  }],
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
