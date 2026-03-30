import type { FlowDefinition } from '../core/types';

/**
 * テンプレート: データパイプライン
 * アイコン主体 + テキストで概念を伝える
 */
export const dataPipeline: FlowDefinition = {
  nodes: [
    { id: 'source', label: 'Data Source', x: 120, y: 120, icon: 'database', color: '#6366f1', width: 36, description: 'API / CSV / DB' },
    { id: 'clean', label: 'Cleaning', x: 320, y: 120, icon: 'filter', color: '#8b5cf6', width: 34 },
    { id: 'transform', label: 'Transform', x: 520, y: 120, icon: 'shuffle', color: '#ec4899', width: 34 },
    { id: 'model', label: 'ML Model', x: 520, y: 300, icon: 'brain', color: '#f59e0b', width: 38, description: 'Train & Predict' },
    { id: 'dashboard', label: 'Dashboard', x: 320, y: 300, icon: 'pie-chart', color: '#10b981', width: 36, description: 'Real-time' },
    { id: 'export', label: 'Export', x: 120, y: 300, icon: 'upload', color: '#06b6d4', width: 34 },
  ],
  edges: [
    { id: 'e1', from: 'source', to: 'clean', particleCount: 1, speed: 1, particleState: { color: '#6366f1', icon: 'file-input', size: 14 } },
    { id: 'e2', from: 'clean', to: 'transform', particleCount: 1, particleState: { color: '#8b5cf6', icon: 'check', size: 12 } },
    { id: 'e3', from: 'transform', to: 'model', particleCount: 1, speed: 0.8 },
    { id: 'e4', from: 'model', to: 'dashboard', particleCount: 1, particleState: { color: '#f59e0b', icon: 'bar-chart', size: 14 } },
    { id: 'e5', from: 'dashboard', to: 'export', particleCount: 1, speed: 0.8 },
  ],
  config: {
    title: 'Data Pipeline',
    subtitle: 'Collect  ·  Process  ·  Visualize  ·  Share',
    width: 640,
    height: 440,
    theme: 'light',
    animationSpeed: 1,
    showLabels: true,
  },
};
