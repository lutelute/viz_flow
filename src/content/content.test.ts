import { describe, it, expect } from 'vitest';
import { content } from './index';
import { diagramsOf } from '../model/diagram';
import { validateDiagram } from '../model/validate';
import { resolveLayout, tableMeasurer } from '../layout';
import { layoutStyleOf } from '../skins/types';
import { sketchSkin } from '../skins/sketch/skin';
import { compileTimeline } from '../timeline';

describe('content', () => {
  for (const entry of content) {
    for (const d of diagramsOf(entry.composition)) {
      it(`${d.id}: 定義に問題が無く、レイアウト警告が無く、タイムラインが組める`, () => {
        expect(validateDiagram(d)).toEqual([]);
        const layout = resolveLayout(d, layoutStyleOf(sketchSkin, tableMeasurer()), '4:5');
        expect(layout.warnings).toEqual([]);
        const tl = compileTimeline(d, layout);
        expect(tl.duration).toBeGreaterThan(0);
        expect(tl.steps.length).toBe(d.steps.length);
        expect(d.sources.length).toBeGreaterThan(0);
      });
    }
  }
});
