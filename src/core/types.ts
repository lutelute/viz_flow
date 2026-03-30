export type NodeShape = 'rect' | 'rounded' | 'diamond' | 'cylinder' | 'document' | 'circle' | 'icon-only';

export interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  icon?: string;
  color?: string;
  width?: number;
  height?: number;
  shape?: NodeShape;
  description?: string;
}

export interface ParticleState {
  color: string;
  icon?: string;
  label?: string;
  size?: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  color?: string;
  speed?: number;
  particleCount?: number;
  label?: string;
  dashed?: boolean;
  /** エッジ通過中のパーティクルの見た目 */
  particleState?: ParticleState;
  /** 矢印を表示するか (default true) */
  arrow?: boolean;
}

export interface FlowConfig {
  title?: string;
  subtitle?: string;
  width: number;
  height: number;
  backgroundColor?: string;
  theme?: 'dark' | 'light';
  animationSpeed?: number;
  showLabels?: boolean;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
  config: FlowConfig;
}
