import { describe, it, expect } from 'vitest';
import { compileTimeline } from './compile';
import { Transport } from './transport';
import { lineFixture } from './fixture';

function make() {
  const { diagram, layout } = lineFixture();
  return new Transport(compileTimeline(diagram, layout));
}

describe('Transport', () => {
  it('初期状態は static、t = 0、rate 1、loop あり', () => {
    const tr = make();
    expect(tr.getState()).toEqual({ mode: 'static', t: 0, rate: 1, loop: true });
  });

  it('play 中だけ tick で進む', () => {
    const tr = make();
    tr.tick(500);
    expect(tr.getState().t).toBe(0);
    tr.play();
    tr.tick(500);
    expect(tr.getState().t).toBeCloseTo(0.5);
    tr.pause();
    expect(tr.getState().mode).toBe('static');
    tr.tick(500);
    expect(tr.getState().t).toBeCloseTo(0.5);
  });

  it('rate を掛けて進む', () => {
    const tr = make();
    tr.setRate(2);
    tr.play();
    tr.tick(500);
    expect(tr.getState().t).toBeCloseTo(1);
  });

  it('loop なら duration で巻き戻る', () => {
    const tr = make();
    const { duration } = tr.timeline;
    tr.play();
    tr.tick((duration + 0.1) * 1000);
    expect(tr.getState().t).toBeCloseTo(0.1);
    expect(tr.getState().mode).toBe('play');
  });

  it('loop 無しなら duration で止まり static になる', () => {
    const tr = make();
    const { duration } = tr.timeline;
    tr.setLoop(false);
    tr.play();
    tr.tick((duration + 1) * 1000);
    expect(tr.getState().t).toBe(duration);
    expect(tr.getState().mode).toBe('static');
    tr.play();
    expect(tr.getState().t).toBe(0);
    expect(tr.getState().mode).toBe('play');
  });

  it('seek は scrub モードにして範囲内に収める', () => {
    const tr = make();
    tr.seek(2.5);
    expect(tr.getState()).toMatchObject({ mode: 'scrub', t: 2.5 });
    tr.seek(-5);
    expect(tr.getState().t).toBe(0);
    tr.seek(999);
    expect(tr.getState().t).toBe(tr.timeline.duration);
  });

  it('seekStep はそのステップの末尾のわずか手前に置く', () => {
    const tr = make();
    tr.seekStep(1);
    expect(tr.getState().mode).toBe('scrub');
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[1].t1 - 0.001);
    tr.seekStep(99);
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[2].t1 - 0.001);
    tr.seekStep(-3);
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[0].t1 - 0.001);
  });

  it('next と prev はステップ単位で動き、端で止まる', () => {
    const tr = make();
    tr.next();
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[1].t1 - 0.001);
    tr.next();
    tr.next();
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[2].t1 - 0.001);
    tr.prev();
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[1].t1 - 0.001);
    tr.prev();
    tr.prev();
    expect(tr.getState().t).toBeCloseTo(tr.timeline.steps[0].t1 - 0.001);
  });

  it('rate は 0.25 から 2 に収める', () => {
    const tr = make();
    tr.setRate(10);
    expect(tr.getState().rate).toBe(2);
    tr.setRate(0.01);
    expect(tr.getState().rate).toBe(0.25);
  });

  it('subscribe は状態が変わったときだけ呼ばれ、解除できる', () => {
    const tr = make();
    const seen: string[] = [];
    const off = tr.subscribe((s) => seen.push(`${s.mode}:${s.t}`));
    tr.pause();
    expect(seen).toEqual([]);
    tr.play();
    tr.tick(0);
    tr.tick(-10);
    tr.tick(100);
    expect(seen).toEqual(['play:0', 'play:0.1']);
    off();
    tr.seek(1);
    expect(seen).toHaveLength(2);
  });

  it('getState は変化が無ければ同じオブジェクトを返す', () => {
    const tr = make();
    const a = tr.getState();
    tr.setRate(1);
    expect(tr.getState()).toBe(a);
    tr.setRate(1.5);
    expect(tr.getState()).not.toBe(a);
  });
});
