import type { FlowDefinition } from '../core/types';

// ── 共通カラー ──
const C = {
  doc: '#6366f1',
  embed: '#8b5cf6',
  vecdb: '#06b6d4',
  query: '#10b981',
  llm: '#ec4899',
  search: '#f59e0b',
  out: '#10b981',
  check: '#ef4444',
  agent: '#f97316',
  graph: '#14b8a6',
};

/** 1. Naive RAG */
export const naiveRag: FlowDefinition = {
  nodes: [
    { id: 'q', label: 'Query', x: 80, y: 120, icon: 'user', color: C.query, width: 30 },
    { id: 'e', label: 'Embedding', x: 220, y: 120, icon: 'cpu', color: C.embed, width: 28 },
    { id: 'db', label: 'Vector DB', x: 360, y: 120, icon: 'database', color: C.vecdb, width: 30 },
    { id: 'llm', label: 'LLM', x: 220, y: 250, icon: 'sparkles', color: C.llm, width: 32 },
    { id: 'out', label: 'Output', x: 360, y: 250, icon: 'mail', color: C.out, width: 28 },
  ],
  edges: [
    { id: 'e1', from: 'q', to: 'e', particleCount: 1 },
    { id: 'e2', from: 'e', to: 'db', particleCount: 1 },
    { id: 'e3', from: 'db', to: 'llm', label: 'chunks', particleCount: 1 },
    { id: 'e4', from: 'q', to: 'llm', dashed: true, particleCount: 1, speed: 0.6 },
    { id: 'e5', from: 'llm', to: 'out', particleCount: 1 },
  ],
  config: { title: 'Naive RAG', width: 440, height: 330, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 2. Multimodal RAG */
export const multimodalRag: FlowDefinition = {
  nodes: [
    { id: 'txt', label: 'Text', x: 80, y: 80, icon: 'file-input', color: C.doc, width: 28 },
    { id: 'img', label: 'Image', x: 80, y: 180, icon: 'eye', color: C.agent, width: 28 },
    { id: 'e', label: 'Embedding', x: 220, y: 130, icon: 'cpu', color: C.embed, width: 28 },
    { id: 'db', label: 'Vector DB', x: 360, y: 130, icon: 'database', color: C.vecdb, width: 30 },
    { id: 'llm', label: 'LLM', x: 280, y: 260, icon: 'sparkles', color: C.llm, width: 32 },
    { id: 'out', label: 'Output', x: 400, y: 260, icon: 'mail', color: C.out, width: 28 },
  ],
  edges: [
    { id: 'e1', from: 'txt', to: 'e', particleCount: 1 },
    { id: 'e2', from: 'img', to: 'e', particleCount: 1 },
    { id: 'e3', from: 'e', to: 'db', particleCount: 1 },
    { id: 'e4', from: 'db', to: 'llm', particleCount: 1 },
    { id: 'e5', from: 'llm', to: 'out', particleCount: 1 },
  ],
  config: { title: 'Multimodal RAG', width: 480, height: 340, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 3. HyDE (Hypothetical Document Embedding) */
export const hydeRag: FlowDefinition = {
  nodes: [
    { id: 'q', label: 'Query', x: 80, y: 140, icon: 'user', color: C.query, width: 30 },
    { id: 'llm1', label: 'LLM', x: 220, y: 140, icon: 'sparkles', color: C.llm, width: 30, description: 'Hypothetical doc' },
    { id: 'e', label: 'Embedding', x: 360, y: 140, icon: 'cpu', color: C.embed, width: 28 },
    { id: 'db', label: 'Vector DB', x: 500, y: 140, icon: 'database', color: C.vecdb, width: 30 },
    { id: 'llm2', label: 'LLM', x: 360, y: 270, icon: 'sparkles', color: C.llm, width: 32, description: 'Final answer' },
    { id: 'out', label: 'Response', x: 500, y: 270, icon: 'mail', color: C.out, width: 28 },
  ],
  edges: [
    { id: 'e1', from: 'q', to: 'llm1', particleCount: 1 },
    { id: 'e2', from: 'llm1', to: 'e', particleCount: 1, particleState: { color: C.llm, icon: 'file-input', size: 12 } },
    { id: 'e3', from: 'e', to: 'db', particleCount: 1 },
    { id: 'e4', from: 'db', to: 'llm2', particleCount: 1 },
    { id: 'e5', from: 'q', to: 'llm2', dashed: true, particleCount: 1, speed: 0.5 },
    { id: 'e6', from: 'llm2', to: 'out', particleCount: 1 },
  ],
  config: { title: 'HyDE RAG', width: 580, height: 350, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 4. Corrective RAG */
export const correctiveRag: FlowDefinition = {
  nodes: [
    { id: 'q', label: 'Query', x: 80, y: 100, icon: 'user', color: C.query, width: 30 },
    { id: 'db', label: 'Vector DB', x: 240, y: 100, icon: 'database', color: C.vecdb, width: 30 },
    { id: 'eval', label: 'Evaluate', x: 400, y: 100, icon: 'target', color: C.check, width: 30, description: 'Relevance check' },
    { id: 'web', label: 'Web Search', x: 400, y: 240, icon: 'globe', color: C.search, width: 30, description: 'Fallback' },
    { id: 'llm', label: 'LLM', x: 240, y: 240, icon: 'sparkles', color: C.llm, width: 32 },
    { id: 'out', label: 'Output', x: 80, y: 240, icon: 'mail', color: C.out, width: 28 },
  ],
  edges: [
    { id: 'e1', from: 'q', to: 'db', particleCount: 1 },
    { id: 'e2', from: 'db', to: 'eval', particleCount: 1 },
    { id: 'e3', from: 'eval', to: 'llm', label: 'pass', particleCount: 1 },
    { id: 'e4', from: 'eval', to: 'web', label: 'fail', dashed: true, particleCount: 1, speed: 0.6 },
    { id: 'e5', from: 'web', to: 'llm', particleCount: 1 },
    { id: 'e6', from: 'llm', to: 'out', particleCount: 1 },
  ],
  config: { title: 'Corrective RAG', width: 480, height: 330, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 5. Graph RAG */
export const graphRag: FlowDefinition = {
  nodes: [
    { id: 'doc', label: 'Documents', x: 80, y: 100, icon: 'layers', color: C.doc, width: 30 },
    { id: 'extract', label: 'Entity Extract', x: 240, y: 100, icon: 'search', color: C.embed, width: 28 },
    { id: 'kg', label: 'Knowledge Graph', x: 400, y: 100, icon: 'git', color: C.graph, width: 34, description: 'Graph DB' },
    { id: 'q', label: 'Query', x: 80, y: 260, icon: 'user', color: C.query, width: 30 },
    { id: 'traverse', label: 'Graph Traverse', x: 240, y: 260, icon: 'shuffle', color: C.graph, width: 30 },
    { id: 'llm', label: 'LLM', x: 400, y: 260, icon: 'sparkles', color: C.llm, width: 32 },
  ],
  edges: [
    { id: 'e1', from: 'doc', to: 'extract', particleCount: 1 },
    { id: 'e2', from: 'extract', to: 'kg', particleCount: 1 },
    { id: 'e3', from: 'q', to: 'traverse', particleCount: 1 },
    { id: 'e4', from: 'kg', to: 'traverse', particleCount: 1, speed: 0.7 },
    { id: 'e5', from: 'traverse', to: 'llm', particleCount: 1, particleState: { color: C.graph, icon: 'git', size: 14 } },
  ],
  config: { title: 'Graph RAG', width: 480, height: 340, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 6. Hybrid RAG */
export const hybridRag: FlowDefinition = {
  nodes: [
    { id: 'q', label: 'Query', x: 80, y: 170, icon: 'user', color: C.query, width: 30 },
    { id: 'dense', label: 'Dense Search', x: 260, y: 90, icon: 'database', color: C.vecdb, width: 28, description: 'Semantic' },
    { id: 'sparse', label: 'Sparse Search', x: 260, y: 250, icon: 'search', color: C.search, width: 28, description: 'BM25' },
    { id: 'rerank', label: 'Re-rank', x: 420, y: 170, icon: 'filter', color: C.embed, width: 30, description: 'Cross-encoder' },
    { id: 'llm', label: 'LLM', x: 560, y: 170, icon: 'sparkles', color: C.llm, width: 32 },
  ],
  edges: [
    { id: 'e1', from: 'q', to: 'dense', particleCount: 1 },
    { id: 'e2', from: 'q', to: 'sparse', particleCount: 1 },
    { id: 'e3', from: 'dense', to: 'rerank', particleCount: 1 },
    { id: 'e4', from: 'sparse', to: 'rerank', particleCount: 1 },
    { id: 'e5', from: 'rerank', to: 'llm', particleCount: 1 },
  ],
  config: { title: 'Hybrid RAG', width: 640, height: 340, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 7. Adaptive RAG */
export const adaptiveRag: FlowDefinition = {
  nodes: [
    { id: 'q', label: 'Query', x: 80, y: 160, icon: 'user', color: C.query, width: 30 },
    { id: 'router', label: 'Router', x: 230, y: 160, icon: 'shuffle', color: C.agent, width: 30, description: 'Classify query' },
    { id: 'simple', label: 'Simple RAG', x: 400, y: 70, icon: 'database', color: C.vecdb, width: 28 },
    { id: 'multi', label: 'Multi-step', x: 400, y: 160, icon: 'layers', color: C.embed, width: 28 },
    { id: 'web', label: 'Web Search', x: 400, y: 250, icon: 'globe', color: C.search, width: 28 },
    { id: 'llm', label: 'LLM', x: 540, y: 160, icon: 'sparkles', color: C.llm, width: 32 },
  ],
  edges: [
    { id: 'e1', from: 'q', to: 'router', particleCount: 1 },
    { id: 'e2', from: 'router', to: 'simple', label: 'easy', particleCount: 1 },
    { id: 'e3', from: 'router', to: 'multi', label: 'complex', particleCount: 1 },
    { id: 'e4', from: 'router', to: 'web', label: 'recent', particleCount: 1 },
    { id: 'e5', from: 'simple', to: 'llm', particleCount: 1 },
    { id: 'e6', from: 'multi', to: 'llm', particleCount: 1 },
    { id: 'e7', from: 'web', to: 'llm', particleCount: 1 },
  ],
  config: { title: 'Adaptive RAG', width: 620, height: 330, theme: 'light', animationSpeed: 1, showLabels: true },
};

/** 8. Agentic RAG */
export const agenticRag: FlowDefinition = {
  nodes: [
    { id: 'q', label: 'Query', x: 80, y: 160, icon: 'user', color: C.query, width: 30 },
    { id: 'planner', label: 'Planner', x: 230, y: 80, icon: 'lightbulb', color: C.agent, width: 30, description: 'Decompose' },
    { id: 'agent1', label: 'Agent 1', x: 400, y: 60, icon: 'search', color: C.search, width: 28, description: 'RAG tool' },
    { id: 'agent2', label: 'Agent 2', x: 400, y: 160, icon: 'globe', color: C.vecdb, width: 28, description: 'Web tool' },
    { id: 'agent3', label: 'Agent 3', x: 400, y: 260, icon: 'code', color: C.embed, width: 28, description: 'Code tool' },
    { id: 'merge', label: 'Merge', x: 540, y: 160, icon: 'layers', color: C.agent, width: 28 },
    { id: 'llm', label: 'LLM', x: 230, y: 260, icon: 'sparkles', color: C.llm, width: 32, description: 'Final synthesis' },
  ],
  edges: [
    { id: 'e1', from: 'q', to: 'planner', particleCount: 1 },
    { id: 'e2', from: 'planner', to: 'agent1', particleCount: 1 },
    { id: 'e3', from: 'planner', to: 'agent2', particleCount: 1 },
    { id: 'e4', from: 'planner', to: 'agent3', particleCount: 1 },
    { id: 'e5', from: 'agent1', to: 'merge', particleCount: 1 },
    { id: 'e6', from: 'agent2', to: 'merge', particleCount: 1 },
    { id: 'e7', from: 'agent3', to: 'merge', particleCount: 1 },
    { id: 'e8', from: 'merge', to: 'llm', particleCount: 1, particleState: { color: C.agent, icon: 'layers', size: 14 } },
  ],
  config: { title: 'Agentic RAG', width: 620, height: 340, theme: 'light', animationSpeed: 1, showLabels: true },
};

export const ragArchitectures = [
  { name: 'Naive RAG', key: 'naive-rag', flow: naiveRag },
  { name: 'Multimodal RAG', key: 'multimodal-rag', flow: multimodalRag },
  { name: 'HyDE RAG', key: 'hyde-rag', flow: hydeRag },
  { name: 'Corrective RAG', key: 'corrective-rag', flow: correctiveRag },
  { name: 'Graph RAG', key: 'graph-rag', flow: graphRag },
  { name: 'Hybrid RAG', key: 'hybrid-rag', flow: hybridRag },
  { name: 'Adaptive RAG', key: 'adaptive-rag', flow: adaptiveRag },
  { name: 'Agentic RAG', key: 'agentic-rag', flow: agenticRag },
];
