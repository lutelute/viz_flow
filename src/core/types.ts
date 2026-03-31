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

// ── JS パーティクルエンジン ──

/** ウェイポイント: ノードID参照 or 絶対座標 */
export type Waypoint = string | { x: number; y: number };

/** グループ内の1つのパーティクル (球) */
export interface GroupParticleBall {
  /** 経由ウェイポイント。string はノードIDとして解決 */
  waypoints: Waypoint[];
  color: string;
  label?: string;
  icon?: string;
  /** グループ内での発射遅延 (秒) */
  delay?: number;
  /** 移動所要時間 (秒)。省略時は距離から自動計算 */
  travel?: number;
  /** 外殻半径 */
  outerRadius?: number;
  /** コア半径 */
  coreRadius?: number;
  /** 全体透明度 (0..1) */
  opacity?: number;
}

/** パーティクルグループ: 同期ループする球の集合 */
export interface ParticleGroup {
  id: string;
  balls: GroupParticleBall[];
  /** 全球到着後のポーズ時間 (秒) default: 3 */
  pauseDuration?: number;
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
  /** パーティクルアニメーション方式。default: 'svg' */
  particleMode?: 'svg' | 'js';
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
  zones?: FlowZone[];
  /** JS パーティクルエンジン用のグループ定義 */
  particleGroups?: ParticleGroup[];
  config: FlowConfig;
}
