// tablist の矢印キー移動。選んだ要素にだけ tabindex=0 を付け、矢印で選択とフォーカスを一緒に動かす。
import type { KeyboardEvent } from 'react';

export type Orientation = 'horizontal' | 'vertical';

/** 押されたキーに応じた移動先を返す。関係ないキーなら null。 */
export function rovingTarget(e: KeyboardEvent, index: number, count: number, orientation: Orientation): number | null {
  if (count === 0) return null;
  const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  switch (e.key) {
    case prevKey:
      return (index - 1 + count) % count;
    case nextKey:
      return (index + 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
