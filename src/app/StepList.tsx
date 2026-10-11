import type { CompiledStep } from '../timeline/types';
import { S } from './strings';

export interface StepListProps {
  steps: CompiledStep[];
  /** 現在のステップ（0 始まり）。静止表示のときは -1 */
  current: number;
  onPick: (index: number) => void;
}

export function StepList({ steps, current, onPick }: StepListProps) {
  return (
    <section aria-labelledby="panel-steps">
      <h2 id="panel-steps">{S.panel.steps}</h2>
      <ol className="steps">
        {steps.map((s) => {
          const now = s.index === current;
          return (
            <li key={s.index}>
              <button type="button" className="steps__btn" aria-current={now ? 'step' : undefined} onClick={() => onPick(s.index)}>
                <span className="steps__mark" aria-hidden="true">
                  {now ? '▶' : ''}
                </span>
                <span className="steps__num">{S.panel.stepNumber(s.n, s.repeat)}</span>
                <span>{s.caption}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
