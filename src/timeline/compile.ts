import type { Diagram, DiagramEdge, DiagramNode, Payload, Step, StepAction, BadgeAnchor } from '../model/diagram';
import type { EdgeGeom, NodeBox, Pt, ResolvedLayout } from '../layout/types';
import { posAt } from '../core/particle-math';
import type { CompiledParticle, CompiledStep, CompiledTimeline, Track } from './types';

export interface CompileOptions {
  /** 粒子速度。省略時は diagram.layout.speedPxPerSec、それも無ければ 220 */
  speedPxPerSec?: number;
  morphSec?: number;
  dwellSec?: number;
  holdSec?: number;
  fadeSec?: number;
  leadIn?: number;
  tail?: number;
  minTravelSec?: number;
}

const DEFAULTS = {
  speedPxPerSec: 220,
  morphSec: 0.35,
  dwellSec: 0.8,
  holdSec: 0.5,
  fadeSec: 0.25,
  leadIn: 0.4,
  tail: 1.5,
  minTravelSec: 0.6,
};

/** バッジを経路から離す距離（px） */
const BADGE_OFFSET = 26;

interface ExpandedStep {
  step: Step;
  repeat?: number;
}

interface ParticleState {
  id: string;
  node: string;
  payload: Payload;
  tracks: Track[];
  /** 最後のトラックの終了時刻。次の action はこれ以降に始まる */
  lastEnd: number;
  alive: boolean;
}

interface StepTargets {
  nodes: Set<string>;
  edges: Set<string>;
  lanes: Set<string>;
  groups: Set<string>;
}

export function samePayload(a: Payload, b: Payload): boolean {
  return (
    a.kind === b.kind &&
    a.label === b.label &&
    a.count === b.count &&
    a.tone === b.tone &&
    (a.ghost ?? false) === (b.ghost ?? false)
  );
}

/**
 * loops を展開してステップ列を作る。
 * 範囲の末尾に差し掛かったとき、その範囲を times - 1 回繰り返して repeat 番号を添える。
 * 範囲どうしが入れ子になる指定は想定しない。
 */
export function expandLoops(steps: Step[], loops: Diagram['loops']): ExpandedStep[] {
  const out: ExpandedStep[] = [];
  for (const step of steps) {
    out.push({ step });
    for (const loop of loops ?? []) {
      const [first, last] = loop.steps;
      if (step.n !== last) continue;
      const range = steps.filter((s) => s.n >= first && s.n <= last);
      for (let r = 2; r <= loop.times; r++) {
        for (const s of range) out.push({ step: s, repeat: r });
      }
    }
  }
  return out;
}

function nodeCenter(box: NodeBox): Pt {
  return { x: box.cx, y: box.cy };
}

function nodeCorner(box: NodeBox, corner: 'ne' | 'nw' | 'se' | 'sw' = 'ne'): Pt {
  switch (corner) {
    case 'ne': return { x: box.x + box.w, y: box.y };
    case 'nw': return { x: box.x, y: box.y };
    case 'se': return { x: box.x + box.w, y: box.y + box.h };
    case 'sw': return { x: box.x, y: box.y + box.h };
  }
}

/** 経路上の位置 at から、進行方向の左手側（上向きの線なら左、右向きの線なら上）に BADGE_OFFSET だけ離した点 */
function badgeOnRoute(geom: EdgeGeom, at: number): Pt {
  const route = geom.route;
  if (route.totalLen === 0) return geom.badgeAt;
  const eps = Math.min(0.01, 1 / route.totalLen);
  const t0 = Math.max(0, Math.min(1 - eps, at));
  const p = posAt(route, at);
  const a = posAt(route, t0);
  const b = posAt(route, t0 + eps);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return geom.badgeAt;
  const left = { x: p.x + (dy / len) * BADGE_OFFSET, y: p.y - (dx / len) * BADGE_OFFSET };
  if (!geom.label) return left;
  // ラベルがある辺では、ラベルと反対側に置く
  const right = { x: p.x - (dy / len) * BADGE_OFFSET, y: p.y + (dx / len) * BADGE_OFFSET };
  const lp = geom.label.pos;
  const dl = Math.hypot(left.x - lp.x, left.y - lp.y);
  const dr = Math.hypot(right.x - lp.x, right.y - lp.y);
  return dl >= dr ? left : right;
}

class Compiler {
  private readonly diagram: Diagram;
  private readonly layout: ResolvedLayout;
  private readonly opt: Required<CompileOptions>;
  private readonly nodeById = new Map<string, DiagramNode>();
  private readonly edgeById = new Map<string, DiagramEdge>();
  private readonly particles = new Map<string, ParticleState>();
  /** 登録順を保つための配列 */
  private readonly order: ParticleState[] = [];

  constructor(diagram: Diagram, layout: ResolvedLayout, opt: Required<CompileOptions>) {
    this.diagram = diagram;
    this.layout = layout;
    this.opt = opt;
    for (const n of diagram.nodes) this.nodeById.set(n.id, n);
    for (const e of diagram.edges) this.edgeById.set(e.id, e);
  }

  run(): CompiledTimeline {
    const expanded = expandLoops(this.diagram.steps, this.diagram.loops);
    const steps: CompiledStep[] = [];
    let cursor = this.opt.leadIn;

    expanded.forEach(({ step, repeat }, index) => {
      const targets: StepTargets = { nodes: new Set(), edges: new Set(), lanes: new Set(), groups: new Set() };
      let stepEnd = cursor;
      for (const action of step.actions) {
        const end = this.applyAction(step, action, cursor, targets);
        stepEnd = Math.max(stepEnd, end);
      }
      for (const id of targets.nodes) {
        const lane = this.nodeById.get(id)?.lane;
        if (lane) targets.lanes.add(lane);
      }
      const t1 = stepEnd + (step.hold ?? this.opt.holdSec);
      steps.push({
        index,
        n: step.n,
        t0: cursor,
        t1,
        caption: step.caption,
        short: step.short,
        detail: step.detail,
        repeat,
        badge: this.badgeOf(step, targets),
        nodes: [...targets.nodes],
        edges: [...targets.edges],
        lanes: [...targets.lanes],
        groups: [...targets.groups],
      });
      cursor = t1;
    });

    const duration = cursor + this.opt.tail;
    for (const p of this.order) {
      if (p.alive) this.fillHold(p, duration);
    }

    const particles: CompiledParticle[] = this.order.map((p) => ({ id: p.id, tracks: p.tracks }));
    return { diagramId: this.diagram.id, leadIn: this.opt.leadIn, duration, steps, particles };
  }

  /** action を適用し、その終了時刻を返す */
  private applyAction(step: Step, action: StepAction, stepStart: number, targets: StepTargets): number {
    switch (action.type) {
      case 'travel': return this.travel(step, action, stepStart, targets);
      case 'dwell': return this.dwell(step, action, stepStart, targets);
      case 'split': return this.split(step, action, stepStart, targets);
      case 'merge': return this.merge(step, action, stepStart, targets);
      case 'end': return this.end(step, action, stepStart);
      case 'highlight':
        for (const id of action.nodes ?? []) targets.nodes.add(id);
        for (const id of action.edges ?? []) targets.edges.add(id);
        for (const id of action.lanes ?? []) targets.lanes.add(id);
        for (const id of action.groups ?? []) targets.groups.add(id);
        return stepStart;
    }
  }

  private travel(
    step: Step,
    action: Extract<StepAction, { type: 'travel' }>,
    stepStart: number,
    targets: StepTargets,
  ): number {
    if (action.edges.length === 0) {
      throw new Error(`ステップ ${step.n}: 粒子 ${action.particle} の travel に edges が無い`);
    }
    const firstEdge = this.edgeOf(step, action.edges[0]);
    let p = this.particles.get(action.particle);
    let t: number;
    if (!p) {
      p = this.spawn(action.particle, firstEdge.from, action.payload, stepStart);
      t = stepStart;
    } else {
      this.assertAlive(step, p);
      if (p.node !== firstEdge.from) {
        throw new Error(
          `ステップ ${step.n}: 粒子 ${p.id} は ${p.node} にいるが、エッジ ${firstEdge.id} は ${firstEdge.from} から出る`,
        );
      }
      t = this.begin(p, stepStart);
      if (!samePayload(p.payload, action.payload)) {
        const at = nodeCenter(this.boxOf(p.node));
        const t1 = t + this.opt.morphSec;
        p.tracks.push({ kind: 'morph', t0: t, t1, node: p.node, at, from: p.payload, to: action.payload });
        t = t1;
      }
    }

    let prev = firstEdge.from;
    for (const edgeId of action.edges) {
      const edge = this.edgeOf(step, edgeId);
      if (edge.from !== prev) {
        throw new Error(`ステップ ${step.n}: 粒子 ${p.id} の経路が ${prev} から ${edge.id}（${edge.from} 始点）へ続かない`);
      }
      const geom = this.geomOf(step, edgeId);
      const dur = Math.max(geom.route.totalLen / this.opt.speedPxPerSec, this.opt.minTravelSec);
      p.tracks.push({
        kind: 'travel', t0: t, t1: t + dur, edge: edge.id, from: edge.from, to: edge.to, route: geom.route, payload: action.payload,
      });
      t += dur;
      prev = edge.to;
      targets.edges.add(edge.id);
      targets.nodes.add(edge.from);
      targets.nodes.add(edge.to);
    }
    p.node = prev;
    p.payload = action.payload;
    p.lastEnd = t;
    return t;
  }

  private dwell(
    step: Step,
    action: Extract<StepAction, { type: 'dwell' }>,
    stepStart: number,
    targets: StepTargets,
  ): number {
    const p = this.require(step, action.particle);
    if (p.node !== action.node) {
      throw new Error(`ステップ ${step.n}: 粒子 ${p.id} は ${p.node} にいるので ${action.node} で dwell できない`);
    }
    const t0 = this.begin(p, stepStart);
    const t1 = t0 + (action.seconds ?? this.opt.dwellSec);
    p.tracks.push({ kind: 'dwell', t0, t1, node: p.node, at: nodeCenter(this.boxOf(p.node)), payload: p.payload, label: action.label });
    p.lastEnd = t1;
    targets.nodes.add(action.node);
    return t1;
  }

  private split(
    step: Step,
    action: Extract<StepAction, { type: 'split' }>,
    stepStart: number,
    targets: StepTargets,
  ): number {
    const p = this.require(step, action.particle);
    if (p.node !== action.at) {
      throw new Error(`ステップ ${step.n}: 粒子 ${p.id} は ${p.node} にいるので ${action.at} で split できない`);
    }
    const t1 = this.fade(p, this.begin(p, stepStart));
    for (const child of action.into) {
      if (this.particles.has(child.particle)) {
        throw new Error(`ステップ ${step.n}: split 先の粒子 ${child.particle} は既に存在する`);
      }
      this.spawn(child.particle, action.at, child.payload, t1);
    }
    targets.nodes.add(action.at);
    return t1;
  }

  private merge(
    step: Step,
    action: Extract<StepAction, { type: 'merge' }>,
    stepStart: number,
    targets: StepTargets,
  ): number {
    let t1 = stepStart;
    for (const id of action.particles) {
      const p = this.require(step, id);
      if (p.node !== action.at) {
        throw new Error(`ステップ ${step.n}: 粒子 ${p.id} は ${p.node} にいるので ${action.at} で merge できない`);
      }
      t1 = Math.max(t1, this.fade(p, this.begin(p, stepStart)));
    }
    if (this.particles.has(action.into.particle)) {
      throw new Error(`ステップ ${step.n}: merge 先の粒子 ${action.into.particle} は既に存在する`);
    }
    this.spawn(action.into.particle, action.at, action.into.payload, t1);
    targets.nodes.add(action.at);
    return t1;
  }

  private end(step: Step, action: Extract<StepAction, { type: 'end' }>, stepStart: number): number {
    const p = this.require(step, action.particle);
    if ((action.mode ?? 'absorb') === 'stay') return p.lastEnd;
    return this.fade(p, this.begin(p, stepStart));
  }

  private spawn(id: string, node: string, payload: Payload, t: number): ParticleState {
    this.boxOf(node);
    const p: ParticleState = { id, node, payload, tracks: [], lastEnd: t, alive: true };
    this.particles.set(id, p);
    this.order.push(p);
    return p;
  }

  /** 粒子の次の action の開始時刻を決め、前のトラックとの隙間を hold で埋める */
  private begin(p: ParticleState, stepStart: number): number {
    const t = Math.max(stepStart, p.lastEnd);
    this.fillHold(p, t);
    return t;
  }

  private fillHold(p: ParticleState, until: number): void {
    if (until <= p.lastEnd) return;
    p.tracks.push({ kind: 'hold', t0: p.lastEnd, t1: until, node: p.node, at: nodeCenter(this.boxOf(p.node)), payload: p.payload });
    p.lastEnd = until;
  }

  private fade(p: ParticleState, t0: number): number {
    const t1 = t0 + this.opt.fadeSec;
    p.tracks.push({ kind: 'fade', t0, t1, node: p.node, at: nodeCenter(this.boxOf(p.node)), payload: p.payload });
    p.lastEnd = t1;
    p.alive = false;
    return t1;
  }

  private require(step: Step, id: string): ParticleState {
    const p = this.particles.get(id);
    if (!p) throw new Error(`ステップ ${step.n}: 粒子 ${id} はまだ生まれていない`);
    this.assertAlive(step, p);
    return p;
  }

  private assertAlive(step: Step, p: ParticleState): void {
    if (!p.alive) throw new Error(`ステップ ${step.n}: 粒子 ${p.id} は既に消えている`);
  }

  private edgeOf(step: Step, id: string): DiagramEdge {
    const e = this.edgeById.get(id);
    if (!e) throw new Error(`ステップ ${step.n}: エッジ ${id} が diagram に無い`);
    return e;
  }

  private geomOf(step: Step, id: string): EdgeGeom {
    const g = this.layout.edges.get(id);
    if (!g) throw new Error(`ステップ ${step.n}: エッジ ${id} の配線がレイアウトに無い`);
    return g;
  }

  private boxOf(id: string): NodeBox {
    const b = this.layout.nodes.get(id);
    if (!b) throw new Error(`ノード ${id} の箱がレイアウトに無い`);
    return b;
  }

  private badgeOf(step: Step, targets: StepTargets): Pt {
    if (step.badge) return this.anchorPoint(step, step.badge);
    const firstTravel = step.actions.find((a) => a.type === 'travel');
    if (firstTravel && firstTravel.type === 'travel' && firstTravel.edges.length > 0) {
      return this.geomOf(step, firstTravel.edges[0]).badgeAt;
    }
    const firstDwell = step.actions.find((a) => a.type === 'dwell');
    if (firstDwell && firstDwell.type === 'dwell') return nodeCorner(this.boxOf(firstDwell.node));
    const firstEdge = targets.edges.values().next();
    if (!firstEdge.done) return this.geomOf(step, firstEdge.value).badgeAt;
    const firstNode = targets.nodes.values().next();
    if (!firstNode.done) return nodeCorner(this.boxOf(firstNode.value));
    return { x: this.layout.figure.x, y: this.layout.figure.y };
  }

  private anchorPoint(step: Step, anchor: BadgeAnchor): Pt {
    if ('edge' in anchor) {
      const geom = this.geomOf(step, anchor.edge);
      return anchor.at === undefined ? geom.badgeAt : badgeOnRoute(geom, anchor.at);
    }
    return nodeCorner(this.boxOf(anchor.node), anchor.corner);
  }
}

export function compileTimeline(diagram: Diagram, layout: ResolvedLayout, opt: CompileOptions = {}): CompiledTimeline {
  const resolved: Required<CompileOptions> = {
    ...DEFAULTS,
    speedPxPerSec: opt.speedPxPerSec ?? diagram.layout?.speedPxPerSec ?? DEFAULTS.speedPxPerSec,
    ...stripUndefined(opt),
  };
  return new Compiler(diagram, layout, resolved).run();
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
