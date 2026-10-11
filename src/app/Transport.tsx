import { useRef, type ChangeEvent } from 'react';
import type { Transport as TransportClock, TransportState } from '../timeline/transport';
import type { CompiledTimeline } from '../timeline/types';
import { S } from './strings';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './Icons';

export interface TransportProps {
  transport: TransportClock;
  timeline: CompiledTimeline;
  state: TransportState;
  /** 現在のステップ（0 始まり）。無ければ -1 */
  stepIndex: number;
}

const RATES = [0.5, 0.75, 1, 1.5, 2];
const FRAME = 1 / 30;

export function Transport({ transport, timeline, state, stepIndex }: TransportProps) {
  const resume = useRef(false);
  const playing = state.mode === 'play';
  const step = timeline.steps[stepIndex] ?? timeline.steps[0];
  const valueText = step ? S.transport.seekValue(step.n, step.caption, state.t) : `${state.t.toFixed(1)} 秒`;

  const onSeek = (e: ChangeEvent<HTMLInputElement>) => transport.seek(Number(e.target.value));
  const onPointerDown = () => {
    resume.current = playing;
  };
  const onPointerUp = () => {
    if (resume.current) transport.play();
    resume.current = false;
  };

  return (
    <section className="transport" aria-label={S.transport.label}>
      <div className="transport__buttons">
        <button type="button" className="ui-btn ui-btn--icon" aria-label={S.transport.prev} title={S.transport.prev} onClick={() => transport.prev()}>
          <PrevIcon />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--icon ui-btn--primary"
          aria-label={playing ? S.transport.pause : S.transport.play}
          title={playing ? S.transport.pause : S.transport.play}
          onClick={() => (playing ? transport.pause() : transport.play())}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="ui-btn ui-btn--icon" aria-label={S.transport.next} title={S.transport.next} onClick={() => transport.next()}>
          <NextIcon />
        </button>
      </div>

      <div className="transport__seek">
        <input
          className="transport__range"
          type="range"
          min={0}
          max={timeline.duration}
          step={FRAME}
          value={state.t}
          aria-label={S.transport.seek}
          aria-valuetext={valueText}
          list="transport-marks"
          onChange={onSeek}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <datalist id="transport-marks">
          {timeline.steps.map((s) => (
            <option key={s.index} value={s.t0} label={S.panel.stepNumber(s.n, s.repeat)} />
          ))}
        </datalist>
        <span className="transport__time">{S.transport.time(state.t, timeline.duration)}</span>
      </div>

      <label className="ui-field">
        <span className="ui-status">{S.transport.rate}</span>
        <select className="ui-select" value={state.rate} onChange={(e) => transport.setRate(Number(e.target.value))}>
          {RATES.map((r) => (
            <option key={r} value={r}>
              {S.transport.rateOption(r)}
            </option>
          ))}
        </select>
      </label>

      <label className="ui-check">
        <input type="checkbox" checked={state.loop} onChange={(e) => transport.setLoop(e.target.checked)} />
        {S.transport.loop}
      </label>
    </section>
  );
}
