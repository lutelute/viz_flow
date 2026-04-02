import type { FlowDefinition, ParticleGroup } from '../core/types';

const C = {
  base: '#94a3b8',
  hi1: '#6366f1', hi2: '#ec4899', hi3: '#f59e0b',
  hi4: '#10b981', hi5: '#ef4444', hi6: '#14b8a6', hi7: '#f97316',
};

// カードサイズ — 縦長（参考画像に合わせる）
const W = 420;
const H = 360;

// 縦フローグリッド — 3列 × 4行
const COL = { L: 80, C: 210, R: 340 };
const ROW = { 1: 95, 2: 160, 3: 225, 4: 290 };

// アイコンサイズ（icon-only, 大きめ）
const SZ = 30;    // 通常
const SZL = 34;   // 強調
const SZS = 26;   // 小さめ

function cfg(title: string, sub: string): FlowDefinition['config'] {
  return { title, subtitle: sub, width: W, height: H, theme: 'light', animationSpeed: 1, showLabels: true, particleMode: 'js' };
}

function ball(waypoints: string[], color: string, opts?: { label?: string; delay?: number; travel?: number }): ParticleGroup['balls'][0] {
  return { waypoints, color, coreRadius: 4, delay: opts?.delay ?? 0, travel: opts?.travel ?? 3, label: opts?.label };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Naive RAG — 縦フロー: Query → Embed → VecDB → LLM → Output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const naiveRag: FlowDefinition = {
  nodes: [
    { id: 'query',  label: 'Query',     x: COL.L, y: ROW[1], icon: 'user',     color: C.hi1, width: SZ },
    { id: 'embed',  label: 'Embed',     x: COL.C, y: ROW[1], icon: 'cpu',      color: C.hi1, width: SZ },
    { id: 'vecdb',  label: 'Vector DB', x: COL.R, y: ROW[2], icon: 'database', color: C.hi1, width: SZL },
    { id: 'llm',    label: 'LLM',       x: COL.C, y: ROW[3], icon: 'sparkles', color: C.hi4, width: SZL },
    { id: 'output', label: 'Output',    x: COL.L, y: ROW[4], icon: 'mail',     color: C.hi1, width: SZS },
  ],
  edges: [
    { id: 'e1', from: 'query', to: 'embed',  color: C.hi1 },
    { id: 'e2', from: 'embed', to: 'vecdb',  color: C.hi1 },
    { id: 'e3', from: 'vecdb', to: 'llm',    color: C.hi1 },
    { id: 'e4', from: 'llm',   to: 'output', color: C.hi1 },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [ball(['query', 'embed', 'vecdb', 'llm', 'output'], C.hi1, { travel: 4 })],
  }],
  config: cfg('Naive RAG', 'Linear — the baseline'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Multimodal RAG — Text/Image → Embed → VecDB → LLM → Output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const multimodalRag: FlowDefinition = {
  nodes: [
    { id: 'text',   label: 'Text',   x: COL.L, y: ROW[1], icon: 'file-input', color: C.hi1, width: SZ },
    { id: 'img',    label: 'Image',  x: COL.R, y: ROW[1], icon: 'eye',        color: C.hi2, width: SZ },
    { id: 'embed',  label: 'Embed',  x: COL.C, y: ROW[2], icon: 'cpu',        color: C.hi1, width: SZ },
    { id: 'vecdb',  label: 'VecDB',  x: COL.C, y: ROW[3], icon: 'database',   color: C.base, width: SZL },
    { id: 'llm',    label: 'LLM',    x: COL.L, y: ROW[4], icon: 'sparkles',   color: C.hi4, width: SZL },
    { id: 'output', label: 'Output', x: COL.R, y: ROW[4], icon: 'mail',       color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'text',  to: 'embed', color: C.hi1 },
    { id: 'h2', from: 'img',   to: 'embed', color: C.hi2 },
    { id: 'h3', from: 'embed', to: 'vecdb' },
    { id: 'h4', from: 'vecdb', to: 'llm' },
    { id: 'h5', from: 'llm',   to: 'output' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      ball(['text', 'embed', 'vecdb', 'llm', 'output'], C.hi1, { label: 'txt', travel: 3.5 }),
      ball(['img', 'embed', 'vecdb', 'llm', 'output'],  C.hi2, { label: 'img', delay: 0.5, travel: 3.5 }),
    ],
  }],
  config: cfg('Multimodal RAG', '+ multi-modal input'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. HyDE — Query → Hypothesis → Embed → VecDB → LLM → Output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const hydeRag: FlowDefinition = {
  nodes: [
    { id: 'query',  label: 'Query',      x: COL.L, y: ROW[1], icon: 'user',      color: C.base, width: SZ },
    { id: 'hypo',   label: 'Hypothesis', x: COL.R, y: ROW[1], icon: 'lightbulb', color: C.hi3,  width: SZL },
    { id: 'embed',  label: 'Embed',      x: COL.C, y: ROW[2], icon: 'cpu',       color: C.hi3,  width: SZ },
    { id: 'vecdb',  label: 'VecDB',      x: COL.C, y: ROW[3], icon: 'database',  color: C.base, width: SZL },
    { id: 'llm',    label: 'LLM',        x: COL.L, y: ROW[4], icon: 'sparkles',  color: C.hi4,  width: SZL },
    { id: 'output', label: 'Output',     x: COL.R, y: ROW[4], icon: 'mail',      color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'query', to: 'hypo',   color: C.hi3 },
    { id: 'h2', from: 'hypo',  to: 'embed',  color: C.hi3 },
    { id: 'h3', from: 'embed', to: 'vecdb' },
    { id: 'h4', from: 'vecdb', to: 'llm' },
    { id: 'h5', from: 'llm',   to: 'output' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [ball(['query', 'hypo', 'embed', 'vecdb', 'llm', 'output'], C.hi3, { label: 'hypo', travel: 4.5 })],
  }],
  config: cfg('HyDE RAG', '+ hypothetical doc before embed'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. Corrective RAG — 上: Query→Embed→VecDB, 中: Check, 下段分岐: ok→LLM / ng→Web→LLM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const correctiveRag: FlowDefinition = {
  nodes: [
    { id: 'query',  label: 'Query',  x: COL.L, y: ROW[1], icon: 'user',     color: C.base, width: SZ },
    { id: 'embed',  label: 'Embed',  x: COL.C, y: ROW[1], icon: 'cpu',      color: C.base, width: SZ },
    { id: 'vecdb',  label: 'VecDB',  x: COL.R, y: ROW[1], icon: 'database', color: C.base, width: SZ },
    { id: 'eval',   label: 'Check',  x: COL.C, y: ROW[2], icon: 'target',   color: C.hi5,  width: SZL },
    { id: 'web',    label: 'Web',    x: COL.R, y: ROW[3], icon: 'globe',    color: C.hi3,  width: SZ },
    { id: 'llm',    label: 'LLM',    x: COL.L, y: ROW[3], icon: 'sparkles', color: C.hi4,  width: SZL },
    { id: 'output', label: 'Output', x: COL.L, y: ROW[4], icon: 'mail',     color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'query', to: 'embed' },
    { id: 'h2', from: 'embed', to: 'vecdb' },
    { id: 'h3', from: 'vecdb', to: 'eval', color: C.hi5 },
    { id: 'h4', from: 'eval',  to: 'llm',  color: C.hi4 },
    { id: 'h5', from: 'eval',  to: 'web',  color: C.hi5, dashed: true },
    { id: 'h6', from: 'web',   to: 'llm',  color: C.hi3 },
    { id: 'h7', from: 'llm',   to: 'output' },
  ],
  particleGroups: [{
    id: 'pass', pauseDuration: 2.5,
    balls: [
      ball(['query', 'embed', 'vecdb', 'eval'], C.base, { travel: 2 }),
      ball(['eval', 'llm', 'output'], C.hi4, { label: 'ok', delay: 2.5, travel: 2 }),
      ball(['eval', 'web', 'llm', 'output'], C.hi5, { label: 'ng', delay: 2.5, travel: 2.5 }),
    ],
  }],
  config: cfg('Corrective RAG', '+ relevance check → fallback'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. Graph RAG — Query → Extract → GraphDB → Traverse → LLM → Output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const graphRag: FlowDefinition = {
  nodes: [
    { id: 'query',    label: 'Query',    x: COL.L, y: ROW[1], icon: 'user',     color: C.base, width: SZ },
    { id: 'extract',  label: 'Extract',  x: COL.R, y: ROW[1], icon: 'search',   color: C.hi6,  width: SZ },
    { id: 'kg',       label: 'GraphDB',  x: COL.C, y: ROW[2], icon: 'git',      color: C.hi6,  width: SZL },
    { id: 'traverse', label: 'Traverse', x: COL.R, y: ROW[3], icon: 'shuffle',  color: C.hi6,  width: SZ },
    { id: 'llm',      label: 'LLM',      x: COL.L, y: ROW[4], icon: 'sparkles', color: C.hi4,  width: SZL },
    { id: 'output',   label: 'Output',   x: COL.R, y: ROW[4], icon: 'mail',     color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'query',    to: 'extract', color: C.hi6 },
    { id: 'h2', from: 'extract',  to: 'kg',      color: C.hi6 },
    { id: 'h3', from: 'kg',       to: 'traverse', color: C.hi6 },
    { id: 'h4', from: 'query',    to: 'traverse', dashed: true },
    { id: 'h5', from: 'traverse', to: 'llm',      color: C.hi6 },
    { id: 'h6', from: 'llm',      to: 'output' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [ball(['query', 'extract', 'kg', 'traverse', 'llm', 'output'], C.hi6, { label: 'entity', travel: 4.5 })],
  }],
  config: cfg('Graph RAG', '+ knowledge graph traversal'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. Hybrid RAG — Query → Dense+Sparse → Re-rank → LLM → Output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const hybridRag: FlowDefinition = {
  nodes: [
    { id: 'query',  label: 'Query',   x: COL.C, y: ROW[1], icon: 'user',     color: C.base, width: SZ },
    { id: 'dense',  label: 'Dense',   x: COL.L, y: ROW[2], icon: 'database', color: C.hi1,  width: SZ },
    { id: 'sparse', label: 'Sparse',  x: COL.R, y: ROW[2], icon: 'search',   color: C.hi3,  width: SZ },
    { id: 'rerank', label: 'Re-rank', x: COL.C, y: ROW[3], icon: 'filter',   color: C.hi2,  width: SZL },
    { id: 'llm',    label: 'LLM',     x: COL.L, y: ROW[4], icon: 'sparkles', color: C.hi4,  width: SZL },
    { id: 'output', label: 'Output',  x: COL.R, y: ROW[4], icon: 'mail',     color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'query',  to: 'dense',  color: C.hi1 },
    { id: 'h2', from: 'query',  to: 'sparse', color: C.hi3 },
    { id: 'h3', from: 'dense',  to: 'rerank', color: C.hi1 },
    { id: 'h4', from: 'sparse', to: 'rerank', color: C.hi3 },
    { id: 'h5', from: 'rerank', to: 'llm',    color: C.hi2 },
    { id: 'h6', from: 'llm',    to: 'output' },
  ],
  zones: [
    { id: 'z1', label: 'DUAL SEARCH', x: COL.L - 30, y: ROW[2] - 30, width: COL.R - COL.L + 60, height: 60, color: C.hi2, dashed: true },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      ball(['query', 'dense', 'rerank'],  C.hi1, { delay: 0, travel: 1.8 }),
      ball(['query', 'sparse', 'rerank'], C.hi3, { delay: 0, travel: 1.8 }),
      ball(['rerank', 'llm', 'output'],   C.hi2, { delay: 2.2, travel: 2 }),
    ],
  }],
  config: cfg('Hybrid RAG', '+ dense + sparse → re-rank'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. Adaptive RAG — Query → Router → RAG/Web/Direct → LLM → Output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const adaptiveRag: FlowDefinition = {
  nodes: [
    { id: 'query',  label: 'Query',  x: COL.C, y: ROW[1], icon: 'user',     color: C.base, width: SZ },
    { id: 'router', label: 'Router', x: COL.C, y: ROW[2], icon: 'shuffle',  color: C.hi7,  width: SZL },
    { id: 'rag',    label: 'RAG',    x: COL.L, y: ROW[3], icon: 'database', color: C.hi1,  width: SZ },
    { id: 'web',    label: 'Web',    x: COL.C, y: ROW[3], icon: 'globe',    color: C.hi3,  width: SZ },
    { id: 'direct', label: 'Direct', x: COL.R, y: ROW[3], icon: 'zap',      color: C.hi7,  width: SZ },
    { id: 'llm',    label: 'LLM',    x: COL.L, y: ROW[4], icon: 'sparkles', color: C.hi4,  width: SZL },
    { id: 'output', label: 'Output', x: COL.R, y: ROW[4], icon: 'mail',     color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'query',  to: 'router', color: C.hi7 },
    { id: 'h2', from: 'router', to: 'rag',    color: C.hi1 },
    { id: 'h3', from: 'router', to: 'web',    color: C.hi3 },
    { id: 'h4', from: 'router', to: 'direct', color: C.hi7 },
    { id: 'h5', from: 'rag',    to: 'llm',    color: C.hi1 },
    { id: 'h6', from: 'web',    to: 'llm',    color: C.hi3 },
    { id: 'h7', from: 'direct', to: 'llm',    color: C.hi7 },
    { id: 'h8', from: 'llm',    to: 'output' },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2.5,
    balls: [
      ball(['query', 'router'], C.hi7, { travel: 1 }),
      ball(['router', 'rag', 'llm'],    C.hi1, { delay: 1.2, travel: 2 }),
      ball(['router', 'web', 'llm'],    C.hi3, { delay: 1.2, travel: 2 }),
      ball(['router', 'direct', 'llm'], C.hi7, { delay: 1.2, travel: 2 }),
      ball(['llm', 'output'], C.base, { delay: 3.5, travel: 1 }),
    ],
  }],
  config: cfg('Adaptive RAG', '+ router → multiple paths'),
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. Agentic RAG — Query → Plan → Tools(3列) → Merge → LLM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const agenticRag: FlowDefinition = {
  nodes: [
    { id: 'query',   label: 'Query', x: COL.L, y: ROW[1], icon: 'user',      color: C.base, width: SZ },
    { id: 'planner', label: 'Plan',  x: COL.C, y: ROW[1], icon: 'lightbulb', color: C.hi7,  width: SZL },
    { id: 'tool1',   label: 'RAG',   x: COL.L, y: ROW[2], icon: 'search',    color: C.hi1,  width: SZ },
    { id: 'tool2',   label: 'Web',   x: COL.C, y: ROW[2], icon: 'globe',     color: C.hi3,  width: SZ },
    { id: 'tool3',   label: 'Code',  x: COL.R, y: ROW[2], icon: 'code',      color: C.hi6,  width: SZ },
    { id: 'merge',   label: 'Merge', x: COL.C, y: ROW[3], icon: 'layers',    color: C.hi7,  width: SZ },
    { id: 'llm',     label: 'LLM',   x: COL.L, y: ROW[4], icon: 'sparkles',  color: C.hi4,  width: SZL },
    { id: 'output',  label: 'Output',x: COL.R, y: ROW[4], icon: 'mail',      color: C.base, width: SZS },
  ],
  edges: [
    { id: 'h1', from: 'query',   to: 'planner', color: C.hi7 },
    { id: 'h2', from: 'planner', to: 'tool1',   color: C.hi1 },
    { id: 'h3', from: 'planner', to: 'tool2',   color: C.hi3 },
    { id: 'h4', from: 'planner', to: 'tool3',   color: C.hi6 },
    { id: 'h5', from: 'tool1',   to: 'merge',   color: C.hi1 },
    { id: 'h6', from: 'tool2',   to: 'merge',   color: C.hi3 },
    { id: 'h7', from: 'tool3',   to: 'merge',   color: C.hi6 },
    { id: 'h8', from: 'merge',   to: 'llm',     color: C.hi7 },
    { id: 'h9', from: 'llm',     to: 'output' },
  ],
  zones: [
    { id: 'z1', label: 'TOOLS', x: COL.L - 30, y: ROW[2] - 30, width: COL.R - COL.L + 60, height: 60, color: C.hi7, dashed: true },
  ],
  particleGroups: [{
    id: 'flow', pauseDuration: 2,
    balls: [
      ball(['query', 'planner'], C.hi7, { travel: 1 }),
      ball(['planner', 'tool1', 'merge'], C.hi1, { delay: 1.2, travel: 1.5 }),
      ball(['planner', 'tool2', 'merge'], C.hi3, { delay: 1.5, travel: 1.5 }),
      ball(['planner', 'tool3', 'merge'], C.hi6, { delay: 1.8, travel: 1.5 }),
      ball(['merge', 'llm', 'output'], C.hi7, { label: 'merged', delay: 3.5, travel: 1.5 }),
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
