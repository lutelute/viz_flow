import { describe, it, expect } from 'vitest';
import type { Step } from '../model/diagram';
import { compileTimeline, expandLoops } from './compile';
import { ANSWER, CHUNKS, LINE_EDGES, LINE_STEPS, QUERY, lineFixture } from './fixture';

describe('compileTimeline', () => {
  it('3 ステップの区間と全体の長さを出す', () => {
    const { diagram, layout } = lineFixture();
    const tl = compileTimeline(diagram, layout);

    expect(tl.diagramId).toBe('line');
    expect(tl.leadIn).toBeCloseTo(0.4);
    expect(tl.steps).toHaveLength(3);

    const [s1, s2, s3] = tl.steps;
    expect(s1.t0).toBeCloseTo(0.4);
    expect(s1.t1).toBeCloseTo(1.9);
    expect(s2.t0).toBeCloseTo(1.9);
    expect(s2.t1).toBeCloseTo(4.75);
    expect(s3.t0).toBeCloseTo(4.75);
    expect(s3.t1).toBeCloseTo(6.85);
    expect(tl.duration).toBeCloseTo(8.35);

    expect(s1.n).toBe(1);
    expect(s1.index).toBe(0);
    expect(s1.caption).toBe('質問を送る');
    expect(s1.repeat).toBeUndefined();
  });

  it('ステップの対象にノード、エッジ、レーンが入る', () => {
    const { diagram, layout } = lineFixture();
    const tl = compileTimeline(diagram, layout);
    const s2 = tl.steps[1];
    expect(s2.edges).toEqual(['bc', 'cd']);
    expect(s2.nodes).toEqual(['b', 'c', 'd']);
    expect(s2.lanes).toEqual(['main']);
    expect(s2.groups).toEqual([]);
  });

  it('粒子のトラックが隙間なく並ぶ', () => {
    const { diagram, layout } = lineFixture();
    const tl = compileTimeline(diagram, layout);
    expect(tl.particles).toHaveLength(1);
    const tracks = tl.particles[0].tracks;
    expect(tracks.map((t) => t.kind)).toEqual([
      'travel', 'hold', 'morph', 'travel', 'travel', 'hold', 'morph', 'travel', 'fade',
    ]);
    for (let i = 1; i < tracks.length; i++) {
      expect(tracks[i].t0).toBeCloseTo(tracks[i - 1].t1);
    }
    const first = tracks[0];
    expect(first.kind).toBe('travel');
    if (first.kind === 'travel') {
      expect(first.from).toBe('a');
      expect(first.to).toBe('b');
      expect(first.t1 - first.t0).toBeCloseTo(1);
    }
  });

  it('payload が変わる境界に morph が入る', () => {
    const { diagram, layout } = lineFixture();
    const tl = compileTimeline(diagram, layout);
    const morph = tl.particles[0].tracks[2];
    expect(morph.kind).toBe('morph');
    if (morph.kind !== 'morph') return;
    expect(morph.node).toBe('b');
    expect(morph.from).toEqual(QUERY);
    expect(morph.to).toEqual(CHUNKS);
    expect(morph.t1 - morph.t0).toBeCloseTo(0.35);
    expect(morph.at).toEqual({ x: layout.nodes.get('b')!.cx, y: layout.nodes.get('b')!.cy });
  });

  it('payload が同じなら morph を入れない', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      { n: 2, caption: '進む', actions: [{ type: 'travel', particle: 'q', edges: ['bc'], payload: { ...QUERY } }] },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);
    expect(tl.particles[0].tracks.map((t) => t.kind)).toEqual(['travel', 'hold', 'travel', 'hold']);
  });

  it('travel の先頭が現在ノードと違えばエラー', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      { n: 2, caption: '飛ぶ', actions: [{ type: 'travel', particle: 'q', edges: ['cd'], payload: QUERY }] },
    ];
    const { diagram, layout } = lineFixture(steps);
    expect(() => compileTimeline(diagram, layout)).toThrowError(/ステップ 2.*粒子 q/);
  });

  it('途中でつながらない経路はエラー', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab', 'cd'], payload: QUERY }] },
    ];
    const { diagram, layout } = lineFixture(steps);
    expect(() => compileTimeline(diagram, layout)).toThrowError(/ステップ 1/);
  });

  it('split で粒子が増え、親は消える', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      {
        n: 2,
        caption: '分ける',
        actions: [
          { type: 'split', particle: 'q', at: 'b', into: [{ particle: 'q1', payload: QUERY }, { particle: 'q2', payload: CHUNKS }] },
          { type: 'travel', particle: 'q1', edges: ['bc'], payload: QUERY },
          { type: 'travel', particle: 'q2', edges: ['bc'], payload: CHUNKS },
        ],
      },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);

    expect(tl.particles.map((p) => p.id)).toEqual(['q', 'q1', 'q2']);
    const q = tl.particles[0].tracks;
    const fade = q[q.length - 1];
    expect(fade.kind).toBe('fade');
    expect(fade.t0).toBeCloseTo(1.9);
    expect(fade.t1).toBeCloseTo(2.15);

    for (const child of tl.particles.slice(1)) {
      const first = child.tracks[0];
      expect(first.kind).toBe('travel');
      expect(first.t0).toBeCloseTo(2.15);
    }
    expect(tl.steps[1].t1).toBeCloseTo(2.15 + 1 + 0.5);
  });

  it('merge で粒子が 1 つになる', () => {
    const steps: Step[] = [
      {
        n: 1,
        caption: '送る',
        actions: [
          { type: 'travel', particle: 'x', edges: ['ab'], payload: QUERY },
          { type: 'travel', particle: 'y', edges: ['ab'], payload: CHUNKS },
        ],
      },
      {
        n: 2,
        caption: '合わせる',
        actions: [
          { type: 'merge', particles: ['x', 'y'], at: 'b', into: { particle: 'z', payload: ANSWER } },
          { type: 'travel', particle: 'z', edges: ['bc'], payload: ANSWER },
        ],
      },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);
    expect(tl.particles.map((p) => p.id)).toEqual(['x', 'y', 'z']);
    const z = tl.particles[2].tracks[0];
    expect(z.kind).toBe('travel');
    expect(z.t0).toBeCloseTo(1.9 + 0.25);
  });

  it('dwell は指定秒か既定 0.8 秒で止まる', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      { n: 2, caption: '考える', actions: [{ type: 'dwell', particle: 'q', node: 'b', seconds: 1.2, label: '検索中' }] },
      { n: 3, caption: '待つ', actions: [{ type: 'dwell', particle: 'q', node: 'b' }] },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);
    const tracks = tl.particles[0].tracks.filter((t) => t.kind === 'dwell');
    expect(tracks).toHaveLength(2);
    expect(tracks[0].t1 - tracks[0].t0).toBeCloseTo(1.2);
    expect(tracks[1].t1 - tracks[1].t0).toBeCloseTo(0.8);
    expect(tl.steps[1].nodes).toEqual(['b']);
  });

  it('end stay の粒子は末尾まで hold で残る', () => {
    const steps: Step[] = [
      {
        n: 1,
        caption: '送る',
        actions: [
          { type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY },
          { type: 'end', particle: 'q', mode: 'stay' },
        ],
      },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);
    const last = tl.particles[0].tracks.at(-1)!;
    expect(last.kind).toBe('hold');
    expect(last.t1).toBeCloseTo(tl.duration);
  });

  it('loops を展開して repeat が付く', () => {
    const edges = [...LINE_EDGES, { id: 'cb', from: 'c', to: 'b' }];
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      { n: 2, caption: '進む', actions: [{ type: 'travel', particle: 'q', edges: ['bc'], payload: QUERY }] },
      { n: 3, caption: '戻る', actions: [{ type: 'travel', particle: 'q', edges: ['cb'], payload: QUERY }] },
    ];
    const { diagram, layout } = lineFixture(steps, { edges, loops: [{ steps: [2, 3], times: 3 }] });
    const tl = compileTimeline(diagram, layout);

    expect(tl.steps.map((s) => s.n)).toEqual([1, 2, 3, 2, 3, 2, 3]);
    expect(tl.steps.map((s) => s.repeat)).toEqual([undefined, undefined, undefined, 2, 2, 3, 3]);
    expect(tl.steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < tl.steps.length; i++) {
      expect(tl.steps[i].t0).toBeCloseTo(tl.steps[i - 1].t1);
    }
  });

  it('expandLoops は範囲の末尾の直後に繰り返しを挿む', () => {
    const out = expandLoops(LINE_STEPS, [{ steps: [1, 2], times: 2 }]);
    expect(out.map((x) => [x.step.n, x.repeat])).toEqual([[1, undefined], [2, undefined], [1, 2], [2, 2], [3, undefined]]);
  });

  it('バッジは既定で最初の travel のエッジに付き、指定があればそこに付く', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
      {
        n: 2,
        caption: '進む',
        badge: { edge: 'bc', at: 0.25 },
        actions: [{ type: 'travel', particle: 'q', edges: ['bc'], payload: QUERY }],
      },
      {
        n: 3,
        caption: '止まる',
        badge: { node: 'c', corner: 'sw' },
        actions: [{ type: 'dwell', particle: 'q', node: 'c' }],
      },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);

    expect(tl.steps[0].badge).toEqual(layout.edges.get('ab')!.badgeAt);

    const bc = layout.edges.get('bc')!;
    const x0 = bc.points[0].x;
    const x1 = bc.points[1].x;
    expect(tl.steps[1].badge.x).toBeCloseTo(x0 + (x1 - x0) * 0.25);
    expect(tl.steps[1].badge.y).toBeCloseTo(bc.points[0].y - 26);

    const c = layout.nodes.get('c')!;
    expect(tl.steps[2].badge).toEqual({ x: c.x, y: c.y + c.h });
  });

  it('速度は opt、diagram.layout、既定 220 の順で決まる', () => {
    const { diagram, layout } = lineFixture(LINE_STEPS, { layout: { speedPxPerSec: 110 } });
    const slow = compileTimeline(diagram, layout);
    expect(slow.particles[0].tracks[0].t1 - slow.particles[0].tracks[0].t0).toBeCloseTo(2);
    const fast = compileTimeline(diagram, layout, { speedPxPerSec: 440 });
    expect(fast.particles[0].tracks[0].t1 - fast.particles[0].tracks[0].t0).toBeCloseTo(0.6);
  });

  it('ステップごとの hold を上書きできる', () => {
    const steps: Step[] = [
      { n: 1, caption: '送る', hold: 2, actions: [{ type: 'travel', particle: 'q', edges: ['ab'], payload: QUERY }] },
    ];
    const { diagram, layout } = lineFixture(steps);
    const tl = compileTimeline(diagram, layout);
    expect(tl.steps[0].t1).toBeCloseTo(0.4 + 1 + 2);
  });
});
