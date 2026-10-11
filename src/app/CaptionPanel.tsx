import type { CompiledStep } from '../timeline/types';
import { S } from './strings';

export interface CaptionPanelProps {
  step: CompiledStep | null;
  /** 一時停止で全ステップを静止表示しているとき */
  isStatic: boolean;
}

/** 現在のキャプション。文はステップが変わるときだけ変わるので、aria-live はその回数だけ読む。 */
export function CaptionPanel({ step, isStatic }: CaptionPanelProps) {
  return (
    <section aria-labelledby="panel-caption">
      <h2 id="panel-caption">{S.panel.caption}</h2>
      <div className="caption" aria-live="polite" aria-atomic="true">
        {isStatic || !step ? (
          <p className="caption__text">{S.panel.static}</p>
        ) : (
          <>
            <p className="caption__text">
              {S.panel.stepNumber(step.n, step.repeat)}. {step.caption}
            </p>
            {step.detail && <p className="caption__detail">{step.detail}</p>}
          </>
        )}
      </div>
    </section>
  );
}
