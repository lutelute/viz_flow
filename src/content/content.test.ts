import { describe, it, expect } from 'vitest';
import { content } from './index';
import { diagramsOf } from '../model/diagram';
import { validateDiagram } from '../model/validate';
import { resolveLayout, tableMeasurer } from '../layout';
import { layoutStyleOf } from '../skins/types';
import { sketchSkin } from '../skins/sketch/skin';
import { compileTimeline } from '../timeline';
import { fitScale } from '../render/fit';

describe('content', () => {
  it('RAG の各図には出典がある', () => {
    for (const entry of content.filter((c) => c.group === 'RAG')) {
      const ds = diagramsOf(entry.composition);
      expect(ds.some((d) => d.sources.length > 0), entry.composition.id).toBe(true);
    }
  });

  for (const entry of content) {
    for (const d of diagramsOf(entry.composition)) {
      it(`${d.id}: 定義に問題が無く、レイアウト警告が無く、タイムラインが組める`, () => {
        expect(validateDiagram(d)).toEqual([]);
        const layout = resolveLayout(d, layoutStyleOf(sketchSkin, tableMeasurer()), '4:5');
        expect(layout.warnings.filter((w) => w.kind !== 'figure-overflow')).toEqual([]);
        expect(fitScale(layout)).toBeGreaterThanOrEqual(0.7);
        const tl = compileTimeline(d, layout);
        expect(tl.duration).toBeGreaterThan(0);
        expect(tl.steps.length).toBe(d.steps.length);
      });
    }
  }
});
