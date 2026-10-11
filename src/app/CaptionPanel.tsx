import type { CompiledStep } from '../timeline/types';
import { S } from './strings';

export interface CaptionPanelProps {
  step: CompiledStep | null;
  /** 一時停止で全ステップを静止表示しているとき */
  isStatic: boolean;
}

/**
 * 現在のステップの知らせ。文はステップ一覧に出ているので、画面には補足（detail）だけを出す。
 * 読み上げには、ステップが変わるときだけ番号と文を 1 回知らせる。
 */
export function CaptionPanel({ step, isStatic }: CaptionPanelProps) {
  const said = isStatic || !step ? S.panel.static : `${S.panel.stepNumber(step.n, step.repeat)}. ${step.caption}`;
  const detail = !isStatic && step?.detail;
  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {said}
      </p>
      {detail && (
        <section aria-labelledby="panel-caption">
          <h2 id="panel-caption">{S.panel.caption}</h2>
          <p className="caption__detail">{detail}</p>
        </section>
      )}
    </>
  );
}
