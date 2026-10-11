import type { Route } from '../core/particle-math';
import { posAt } from '../core/particle-math';
import type { Payload } from '../model/diagram';
import type { CompiledStep, CompiledTimeline, FrameState, NodeState, ParticleFrame, Phase, Track } from './types';

/** 到着の印が消えるまでの秒数 */
const PULSE_SEC = 0.5;

/** 静止画で同じエッジに複数の粒子を載せるときの位置 */
const STATIC_SLOTS: Record<number, number[]> = {
  1: [0.62],
  2: [0.3, 0.72],
  3: [0.28, 0.5, 0.72],
};

export function stepIndexAt(tl: CompiledTimeline, t: number): number {
  const steps = tl.steps;
  if (steps.length === 0) return -1;
  if (t < steps[0].t0) return 0;
  if (t >= steps[steps.length - 1].t1) return steps.length - 1;
  let lo = 0;
  let hi = steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (steps[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 経路上の位置 u における進行方向（度、0 = 右向き、y 下向きが正） */
export function headingAt(route: Route, u: number): number {
  if (route.totalLen === 0) return 0;
  const eps = Math.min(0.01, 1 / route.totalLen);
  const a = Math.max(0, Math.min(1 - eps, u));
  const p = posAt(route, a);
  const q = posAt(route, a + eps);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** t0 <= t を満たす最後のトラックの添字。無ければ -1 */
function trackIndexAt(tracks: Track[], t: number): number {
  let lo = 0;
  let hi = tracks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tracks[mid].t0 <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** 直前の travel が終わったときの向き。無ければ 0 */
function lastHeadingBefore(tracks: Track[], idx: number): number {
  for (let i = idx - 1; i >= 0; i--) {
    const tr = tracks[i];
    if (tr.kind === 'travel') return headingAt(tr.route, 1);
  }
  return 0;
}

function phaseTOf(tr: Track, t: number): number {
  const span = tr.t1 - tr.t0;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (t - tr.t0) / span));
}

function particleAt(id: string, tracks: Track[], t: number): ParticleFrame | undefined {
  const idx = trackIndexAt(tracks, t);
  if (idx < 0) return undefined;
  const tr = tracks[idx];
  if (t >= tr.t1) {
    const isLast = idx === tracks.length - 1;
    if (!isLast || tr.kind === 'fade') return undefined;
  }
  const phaseT = phaseTOf(tr, t);
  switch (tr.kind) {
    case 'travel': {
      const p = posAt(tr.route, phaseT);
      return {
        id, x: p.x, y: p.y, heading: headingAt(tr.route, phaseT), payload: tr.payload, phase: 'travel', phaseT, edge: tr.edge,
      };
    }
    case 'morph':
      return {
        id, x: tr.at.x, y: tr.at.y, heading: lastHeadingBefore(tracks, idx), payload: tr.to, phase: 'morph', phaseT, morphFrom: tr.from, node: tr.node,
      };
    case 'dwell':
    case 'hold':
    case 'fade':
      return {
        id, x: tr.at.x, y: tr.at.y, heading: lastHeadingBefore(tracks, idx), payload: tr.payload, phase: tr.kind, phaseT, node: tr.node,
      };
  }
}

function phaseOf(steps: CompiledStep[], t: number): Phase {
  if (steps.length === 0) return 'pending';
  for (const s of steps) {
    if (s.t0 <= t && t < s.t1) return 'active';
  }
  return t < steps[0].t0 ? 'pending' : 'done';
}

/** id ごとに、それを含むステップの一覧（index 昇順） */
function stepsByTarget(steps: CompiledStep[], pick: (s: CompiledStep) => string[]): Map<string, CompiledStep[]> {
  const map = new Map<string, CompiledStep[]>();
  for (const s of steps) {
    for (const id of pick(s)) {
      const list = map.get(id);
      if (list) list.push(s);
      else map.set(id, [s]);
    }
  }
  return map;
}

interface TargetIndex {
  nodes: Map<string, CompiledStep[]>;
  edges: Map<string, CompiledStep[]>;
}

/** timeline は不変なので、ノードとエッジの逆引きは 1 度だけ作って使い回す */
const targetIndexCache = new WeakMap<CompiledTimeline, TargetIndex>();

function targetIndexOf(tl: CompiledTimeline): TargetIndex {
  let idx = targetIndexCache.get(tl);
  if (!idx) {
    idx = {
      nodes: stepsByTarget(tl.steps, (s) => s.nodes),
      edges: stepsByTarget(tl.steps, (s) => s.edges),
    };
    targetIndexCache.set(tl, idx);
  }
  return idx;
}

export function sampleAt(tl: CompiledTimeline, t: number): FrameState {
  const stepIndex = stepIndexAt(tl, t);
  let stepProgress = 0;
  if (stepIndex >= 0) {
    const s = tl.steps[stepIndex];
    stepProgress = t < s.t0 ? 0 : t >= s.t1 ? 1 : (t - s.t0) / (s.t1 - s.t0);
  }

  const particles: ParticleFrame[] = [];
  for (const p of tl.particles) {
    const f = particleAt(p.id, p.tracks, t);
    if (f) particles.push(f);
  }

  const { nodes: nodeSteps, edges: edgeSteps } = targetIndexOf(tl);

  const nodes: Record<string, NodeState> = {};
  for (const [id, steps] of nodeSteps) nodes[id] = { phase: phaseOf(steps, t) };

  for (const p of tl.particles) {
    for (const tr of p.tracks) {
      if (tr.t0 > t) break;
      if (tr.kind === 'dwell' && t < tr.t1) {
        const n = (nodes[tr.node] ??= { phase: 'active' });
        n.phase = 'processing';
        n.progress = phaseTOf(tr, t);
      }
      if (tr.kind === 'travel' && tr.t1 <= t && t < tr.t1 + PULSE_SEC) {
        const n = (nodes[tr.to] ??= { phase: 'active' });
        const pulse = 1 - (t - tr.t1) / PULSE_SEC;
        n.pulse = Math.max(n.pulse ?? 0, pulse);
      }
    }
  }

  const edges: Record<string, Phase> = {};
  for (const [id, steps] of edgeSteps) edges[id] = phaseOf(steps, t);

  const badges: Record<number, Phase> = {};
  for (const s of tl.steps) badges[s.index] = t < s.t0 ? 'pending' : t < s.t1 ? 'active' : 'done';

  return { t, mode: 'animated', stepIndex, stepProgress, particles, nodes, edges, badges };
}

function staticSlots(count: number): number[] {
  const fixed = STATIC_SLOTS[count];
  if (fixed) return fixed;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(0.3 + (0.4 * i) / (count - 1));
  return out;
}

/**
 * 全 travel を経路の途中に置いた 1 枚絵。
 * 同じ粒子が同じエッジを何度も通る（ループ）ときは 1 つにまとめる。
 * 止まっている粒子と消えた粒子は置かない。
 */
export function sampleStatic(tl: CompiledTimeline): FrameState {
  const byEdge = new Map<string, Array<{ id: string; route: Route; payload: Payload }>>();
  for (const p of tl.particles) {
    const seen = new Set<string>();
    for (const tr of p.tracks) {
      if (tr.kind !== 'travel' || seen.has(tr.edge)) continue;
      seen.add(tr.edge);
      const list = byEdge.get(tr.edge);
      const item = { id: p.id, route: tr.route, payload: tr.payload };
      if (list) list.push(item);
      else byEdge.set(tr.edge, [item]);
    }
  }

  const particles: ParticleFrame[] = [];
  for (const [edge, items] of byEdge) {
    const slots = staticSlots(items.length);
    items.forEach((item, i) => {
      const u = slots[i];
      const pos = posAt(item.route, u);
      particles.push({
        id: item.id, x: pos.x, y: pos.y, heading: headingAt(item.route, u), payload: item.payload, phase: 'travel', phaseT: u, edge,
      });
    });
  }

  const nodes: Record<string, NodeState> = {};
  const edges: Record<string, Phase> = {};
  const badges: Record<number, Phase> = {};
  for (const s of tl.steps) {
    for (const id of s.nodes) nodes[id] = { phase: 'pending' };
    for (const id of s.edges) edges[id] = 'pending';
    badges[s.index] = 'done';
  }

  return { t: 0, mode: 'static', stepIndex: -1, stepProgress: 0, particles, nodes, edges, badges };
}
