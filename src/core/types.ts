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
  /** trueでベース構造（グレー表示、差分でない） */
  muted?: boolean;
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
  /** アニメーション開始の遅延（秒）。フロー順序を表現するために使う */
  delay?: number;
}

export interface FlowZone {
  id: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  /** 破線の枠にするか (default false) */
  dashed?: boolean;
  /** ラベルの位置 (default 'top-left') */
  labelPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center';
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
  zones?: FlowZone[];
  config: FlowConfig;
}
