import { describe, it, expect } from 'vitest';
import type { Step } from '../model/diagram';
import { compileTimeline } from './compile';
import { headingAt, sampleAt, sampleStatic, stepIndexAt } from './sample';
import { CHUNKS, QUERY, lineFixture } from './fixture';
import { buildSegments } from '../core/particle-math';

function compiled(steps?: Step[]) {
  const { diagram, layout } = lineFixture(steps);
  return { tl: compileTimeline(diagram, layout), layout };
}

describe('stepIndexAt', () => {
  it('leadIn 中は 0、tail 中は最後', () => {
    const { tl } = compiled();
    expect(stepIndexAt(tl, 0)).toBe(0);
    expect(stepIndexAt(tl, 0.39)).toBe(0);
    expect(stepIndexAt(tl, tl.steps[1].t0)).toBe(1);
    expect(stepIndexAt(tl, tl.steps[1].t1 - 1e-6)).toBe(1);
    expect(stepIndexAt(tl, tl.steps[2].t1 + 0.5)).toBe(2);
    expect(stepIndexAt(tl, tl.duration)).toBe(2);
  });

  it('ステップが無ければ -1', () => {
    const { tl } = compiled([]);
    expect(stepIndexAt(tl, 0)).toBe(-1);
  });
});

describe('sampleAt', () => {
  it('同じ t なら同じ結果', () => {
    const { tl } = compiled();
    const a = sampleAt(tl, 3.1);
    const b = sampleAt(tl, 3.1);
    expect(a).toEqual(b);
    expect(a.mode).toBe('animated');
  });

  it('JSON 化しても失われない', () => {
    const { tl } = compiled();
    const f = sampleAt(tl, 2.0);
    expect(JSON.parse(JSON.stringify(f))).toEqual(f);
  });

  it('t = 0 で全ノード pending、粒子なし', () => {
    const { tl } = compiled();
    const f = sampleAt(tl, 0);
    expect(f.stepIndex).toBe(0);
    expect(f.stepProgress).toBe(0);
    expect(f.particles).toEqual([]);
    expect(Object.keys(f.nodes).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    for (const n of Object.values(f.nodes)) expect(n.phase).toBe('pending');
    for (const e of Object.values(f.edges)) expect(e).toBe('pending');
    for (const b of Object.values(f.badges)) expect(b).toBe('pending');
  });

  it('末尾で全バッジ done、粒子は消えている', () => {
    const { tl } = compiled();
    const f = sampleAt(tl, tl.duration - 0.1);
    expect(f.stepIndex).toBe(2);
    expect(f.stepProgress).toBe(1);
    expect(Object.values(f.badges)).toEqual(['done', 'done', 'done']);
    for (const n of Object.values(f.nodes)) expect(n.phase).toBe('done');
    expect(f.particles).toEqual([]);
  });

  it('travel 中は経路上の位置と向きを出す', () => {
    const { tl, layout } = compiled();
    const bc = layout.edges.get('bc')!;
    const f = sampleAt(tl, 2.25 + 0.5);
    expect(f.stepIndex).toBe(1);
    expect(f.particles).toHaveLength(1);
    const p = f.particles[0];
    expect(p.phase).toBe('travel');
    expect(p.edge).toBe('bc');
    expect(p.phaseT).toBeCloseTo(0.5);
    expect(p.x).toBeCloseTo((bc.points[0].x + bc.points[1].x) / 2);
    expect(p.y).toBeCloseTo(bc.points[0].y);
    expect(p.heading).toBeCloseTo(0);
    expect(p.payload).toEqual(CHUNKS);
    expect(f.edges.bc).toBe('active');
    expect(f.edges.ab).toBe('done');
    expect(f.edges.de).toBe('pending');
    expect(f.badges[1]).toBe('active');
  });

  it('morph 中は morphFrom を付けてノード上に止まる', () => {
    const { tl, layout } = compiled();
    const f = sampleAt(tl, 1.9 + 0.1);
    const p = f.particles[0];
    expect(p.phase).toBe('morph');
    expect(p.morphFrom).toEqual(QUERY);
    expect(p.payload).toEqual(CHUNKS);
    expect(p.node).toBe('b');
    expect(p.x).toBe(layout.nodes.get('b')!.cx);
    expect(p.phaseT).toBeCloseTo(0.1 / 0.35);
  });

  it('到着直後のノードに pulse が付いて 0.5 秒で消える', () => {
    const { tl } = compiled();
    const arrive = 1.4;
    expect(sampleAt(tl, arrive + 0.1).nodes.b.pulse).toBeCloseTo(0.8);
    expect(sampleAt(tl, arrive + 0.6).nodes.b.pulse).toBeUndefined();
    expect(sampleAt(tl, arrive - 0.1).nodes.b.pulse).toBeUndefined();
  });

  it('dwell 中のノードは processing と progress', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      { n: 2, caption: '考える', actions: [{ type: 'dwell', particle: 'q', node: 'b', seconds: 1 }] },
    ];
    const { tl } = compiled(steps);
    const f = sampleAt(tl, 1.9 + 0.25);
    expect(f.nodes.b.phase).toBe('processing');
    expect(f.nodes.b.progress).toBeCloseTo(0.25);
    expect(f.particles[0].phase).toBe('dwell');
    expect(f.nodes.a.phase).toBe('done');
  });

  it('ステップ間の粒子は hold で止まる', () => {
    const { tl, layout } = compiled();
    const f = sampleAt(tl, 1.6);
    const p = f.particles[0];
    expect(p.phase).toBe('hold');
    expect(p.node).toBe('b');
    expect(p.x).toBe(layout.nodes.get('b')!.cx);
    expect(p.heading).toBeCloseTo(0);
  });
});

describe('sampleStatic', () => {
  it('全 travel に粒子を置く', () => {
    const { tl, layout } = compiled();
    const f = sampleStatic(tl);
    expect(f.mode).toBe('static');
    expect(f.stepIndex).toBe(-1);
    expect(f.particles.map((p) => p.edge).sort()).toEqual(['ab', 'bc', 'cd', 'de']);
    for (const p of f.particles) {
      const g = layout.edges.get(p.edge!)!;
      expect(p.phaseT).toBe(0.5);
      expect(p.x).toBeCloseTo(g.points[0].x + (g.points[1].x - g.points[0].x) * 0.5);
      expect(p.phase).toBe('travel');
    }
    expect(Object.values(f.badges)).toEqual(['done', 'done', 'done']);
    for (const n of Object.values(f.nodes)) expect(n.phase).toBe('pending');
  });

  it('同じエッジに複数あっても最初の 1 つだけを置く', () => {
    const steps: Step[] = [
      {
        n: 1,
        caption: '送る',
        actions: [
          { type: 'travel', particle: 'x', edges: ['ab'], payload: QUERY },
          { type: 'travel', particle: 'y', edges: ['ab'], payload: CHUNKS },
          { type: 'travel', particle: 'z', edges: ['ab'], payload: QUERY },
        ],
      },
    ];
    const { tl } = compiled(steps);
    const f = sampleStatic(tl);
    expect(f.particles.map((p) => p.phaseT)).toEqual([0.5]);
    expect(f.particles.map((p) => p.id)).toEqual(['x']);
  });

  it('同じ粒子が同じエッジを繰り返し通っても 1 つにまとめる', () => {
    const { diagram, layout } = lineFixture(
      [
        { n: 1, caption: '進む', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
        { n: 2, caption: '戻る', actions: [{ type: 'travel', particle: 'q', edges: ['ba'], payload: QUERY }] },
      ],
      { edges: [{ id: 'ab', from: 'a', to: 'b' }, { id: 'ba', from: 'b', to: 'a' }], loops: [{ steps: [1, 2], times: 3 }] },
    );
    const f = sampleStatic(compileTimeline(diagram, layout));
    expect(f.particles).toHaveLength(2);
  });
});

describe('headingAt', () => {
  it('右向きは 0、下向きは 90', () => {
    expect(headingAt(buildSegments([{ x: 0, y: 0 }, { x: 10, y: 0 }]), 0.5)).toBeCloseTo(0);
    expect(headingAt(buildSegments([{ x: 0, y: 0 }, { x: 0, y: 10 }]), 0.5)).toBeCloseTo(90);
    expect(headingAt(buildSegments([{ x: 0, y: 0 }, { x: -10, y: 0 }]), 1)).toBeCloseTo(180);
  });
});
