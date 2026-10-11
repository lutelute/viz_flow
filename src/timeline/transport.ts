import type { CompiledTimeline } from './types';
import { stepIndexAt } from './sample';

export type TransportMode = 'play' | 'scrub' | 'static';

export interface TransportState {
  mode: TransportMode;
  t: number;
  rate: number;
  loop: boolean;
}

export const MIN_RATE = 0.25;
export const MAX_RATE = 2;

/** seekStep が止める位置。ステップ末のわずか手前に置くと「到着して変身も終わった」姿が見える */
const STEP_END_MARGIN = 0.001;

/**
 * 再生位置と再生モードだけを持つ。時計は持たず、外から tick(dtMs) で進める。
 * 状態は変わるたびに新しいオブジェクトに差し替えるので、getState() の同一性で変化を検知できる。
 */
export class Transport {
  readonly timeline: CompiledTimeline;
  private state: TransportState;
  private readonly listeners = new Set<(s: TransportState) => void>();

  constructor(timeline: CompiledTimeline, init: Partial<TransportState> = {}) {
    this.timeline = timeline;
    this.state = {
      mode: init.mode ?? 'static',
      t: this.clampT(init.t ?? 0),
      rate: clampRate(init.rate ?? 1),
      loop: init.loop ?? true,
    };
  }

  subscribe(cb: (s: TransportState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): TransportState {
    return this.state;
  }

  play(): void {
    const { t, loop } = this.state;
    const restart = !loop && t >= this.timeline.duration;
    this.update({ mode: 'play', t: restart ? 0 : t });
  }

  pause(): void {
    this.update({ mode: 'static' });
  }

  seek(t: number): void {
    this.update({ mode: 'scrub', t: this.clampT(t) });
  }

  seekStep(i: number): void {
    const steps = this.timeline.steps;
    if (steps.length === 0) return;
    const idx = Math.max(0, Math.min(steps.length - 1, Math.trunc(i)));
    this.update({ mode: 'scrub', t: this.clampT(steps[idx].t1 - STEP_END_MARGIN) });
  }

  next(): void {
    this.seekStep(this.currentStep() + 1);
  }

  prev(): void {
    this.seekStep(this.currentStep() - 1);
  }

  setRate(r: number): void {
    this.update({ rate: clampRate(r) });
  }

  setLoop(b: boolean): void {
    this.update({ loop: b });
  }

  /** 再生中だけ時間を進める。dtMs は非負の有限値だけを受け付ける */
  tick(dtMs: number): void {
    if (this.state.mode !== 'play') return;
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;
    const { duration } = this.timeline;
    let t = this.state.t + (dtMs / 1000) * this.state.rate;
    if (duration <= 0) {
      this.update({ t: 0, mode: 'static' });
      return;
    }
    if (this.state.loop) {
      t %= duration;
      this.update({ t });
      return;
    }
    if (t >= duration) {
      this.update({ t: duration, mode: 'static' });
      return;
    }
    this.update({ t });
  }

  private currentStep(): number {
    return Math.max(0, stepIndexAt(this.timeline, this.state.t));
  }

  private clampT(t: number): number {
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, Math.min(this.timeline.duration, t));
  }

  private update(patch: Partial<TransportState>): void {
    const prev = this.state;
    const next: TransportState = { ...prev, ...patch };
    if (next.mode === prev.mode && next.t === prev.t && next.rate === prev.rate && next.loop === prev.loop) return;
    this.state = next;
    for (const cb of this.listeners) cb(next);
  }
}

export function clampRate(r: number): number {
  if (!Number.isFinite(r)) return 1;
  return Math.max(MIN_RATE, Math.min(MAX_RATE, r));
}
