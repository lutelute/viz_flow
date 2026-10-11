import type { Payload } from '../model/diagram';
import type { Pt } from '../layout/types';
import type { Route } from '../core/particle-math';

/** 粒子 1 つの時間軸上の区間。t0 昇順で並ぶ。 */
export type Track =
  | { kind: 'travel'; t0: number; t1: number; edge: string; from: string; to: string; route: Route; payload: Payload }
  | { kind: 'dwell'; t0: number; t1: number; node: string; at: Pt; payload: Payload; label?: string }
  | { kind: 'morph'; t0: number; t1: number; node: string; at: Pt; from: Payload; to: Payload }
  | { kind: 'hold'; t0: number; t1: number; node: string; at: Pt; payload: Payload }
  | { kind: 'fade'; t0: number; t1: number; node: string; at: Pt; payload: Payload };

export interface CompiledParticle {
  id: string;
  tracks: Track[];
}

export interface CompiledStep {
  index: number;
  n: number;
  t0: number;
  t1: number;
  caption: string;
  short?: string;
  detail?: string;
  /** 2 回目以降のループなら 2, 3, … */
  repeat?: number;
  badge: Pt;
  nodes: string[];
  edges: string[];
  lanes: string[];
  groups: string[];
}

export interface CompiledTimeline {
  diagramId: string;
  leadIn: number;
  /** 1 ループの長さ（秒、rate = 1） */
  duration: number;
  steps: CompiledStep[];
  particles: CompiledParticle[];
}

export type Phase = 'pending' | 'active' | 'processing' | 'done';

export interface ParticleFrame {
  id: string;
  x: number;
  y: number;
  /** 進行方向。度。0 = 右向き */
  heading: number;
  payload: Payload;
  phase: Track['kind'];
  /** 区間内の進捗 0..1 */
  phaseT: number;
  morphFrom?: Payload;
  edge?: string;
  node?: string;
}

export interface NodeState {
  phase: Phase;
  /** processing 中の進捗 0..1 */
  progress?: number;
  /** 粒子到着直後は 1 で、0.5 秒かけて 0 になる */
  pulse?: number;
}

/** 任意の t における描画状態。Set を使わず JSON 化できる形にする。 */
export interface FrameState {
  t: number;
  mode: 'animated' | 'static';
  stepIndex: number;
  stepProgress: number;
  particles: ParticleFrame[];
  nodes: Record<string, NodeState>;
  edges: Record<string, Phase>;
  badges: Record<number, Phase>;
}
