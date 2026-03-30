import type { FlowDefinition } from '../core/types';

/**
 * テンプレート: 研究プロセス
 */
export const researchProcess: FlowDefinition = {
  nodes: [
    { id: 'question', label: 'Research Question', x: 330, y: 80, icon: 'search', color: '#6366f1', width: 40 },
    { id: 'lit', label: 'Literature', x: 160, y: 220, icon: 'layers', color: '#8b5cf6', width: 34, description: 'Prior work' },
    { id: 'hypo', label: 'Hypothesis', x: 500, y: 220, icon: 'lightbulb', color: '#f59e0b', width: 36, description: 'H0 / H1' },
    { id: 'exp', label: 'Experiment', x: 330, y: 360, icon: 'cpu', color: '#ec4899', width: 38, description: 'Simulation / Lab' },
    { id: 'result', label: 'Results', x: 160, y: 500, icon: 'bar-chart', color: '#10b981', width: 36, description: 'Analysis' },
    { id: 'paper', label: 'Publication', x: 500, y: 500, icon: 'globe', color: '#06b6d4', width: 36, description: 'Journal / Conf' },
  ],
  edges: [
    { id: 'e1', from: 'question', to: 'lit', particleCount: 1 },
    { id: 'e2', from: 'question', to: 'hypo', particleCount: 1 },
    { id: 'e3', from: 'lit', to: 'exp', particleCount: 1, particleState: { color: '#8b5cf6', icon: 'layers', size: 14 } },
    { id: 'e4', from: 'hypo', to: 'exp', particleCount: 1, particleState: { color: '#f59e0b', icon: 'lightbulb', size: 14 } },
    { id: 'e5', from: 'exp', to: 'result', particleCount: 1, particleState: { color: '#ec4899', icon: 'bar-chart', size: 14 } },
    { id: 'e6', from: 'result', to: 'paper', particleCount: 1, particleState: { color: '#10b981', icon: 'check', size: 12 } },
    { id: 'e7', from: 'result', to: 'question', dashed: true, speed: 0.4, particleCount: 1, label: 'iterate' },
  ],
  config: {
    title: 'Research Process',
    subtitle: 'Question  ·  Experiment  ·  Publish  ·  Iterate',
    width: 660,
    height: 620,
    theme: 'light',
    animationSpeed: 1,
    showLabels: true,
  },
};
