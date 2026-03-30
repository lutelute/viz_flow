import type { FlowDefinition } from '../core/types';

/**
 * テンプレート: RAGパイプライン
 * アイコン主体で概念と説明が融合
 */
export const aiWorkflow: FlowDefinition = {
  nodes: [
    { id: 'docs', label: 'Documents', x: 110, y: 100, icon: 'layers', color: '#6366f1', width: 36, description: 'PDF / Web' },
    { id: 'embed', label: 'Embedding', x: 330, y: 100, icon: 'cpu', color: '#8b5cf6', width: 34 },
    { id: 'vecdb', label: 'Vector DB', x: 550, y: 100, icon: 'database', color: '#06b6d4', width: 36 },
    { id: 'query', label: 'User Query', x: 110, y: 290, icon: 'user', color: '#10b981', width: 36 },
    { id: 'retrieve', label: 'Retrieve', x: 550, y: 290, icon: 'search', color: '#f59e0b', width: 36, description: 'Top-K chunks' },
    { id: 'llm', label: 'LLM', x: 330, y: 420, icon: 'sparkles', color: '#ec4899', width: 40, description: 'Generate answer' },
    { id: 'response', label: 'Response', x: 550, y: 420, icon: 'mail', color: '#10b981', width: 34 },
  ],
  edges: [
    { id: 'e1', from: 'docs', to: 'embed', label: 'Encode', particleCount: 1, particleState: { color: '#6366f1', icon: 'file-input', size: 14 } },
    { id: 'e2', from: 'embed', to: 'vecdb', label: 'Index', particleCount: 1, particleState: { color: '#8b5cf6', icon: 'box', size: 12 } },
    { id: 'e3', from: 'query', to: 'retrieve', particleCount: 1, particleState: { color: '#10b981', icon: 'search', size: 14 } },
    { id: 'e4', from: 'vecdb', to: 'retrieve', particleCount: 1, speed: 0.8 },
    { id: 'e5', from: 'retrieve', to: 'llm', label: 'Context', particleCount: 1, particleState: { color: '#f59e0b', icon: 'layers', size: 14 } },
    { id: 'e6', from: 'query', to: 'llm', label: 'Prompt', dashed: true, particleCount: 1, speed: 0.7 },
    { id: 'e7', from: 'llm', to: 'response', particleCount: 1, particleState: { color: '#ec4899', icon: 'sparkles', size: 14 } },
  ],
  config: {
    title: 'RAG Pipeline',
    subtitle: 'Retrieval-Augmented Generation',
    width: 660,
    height: 530,
    theme: 'light',
    animationSpeed: 1,
    showLabels: true,
  },
};
