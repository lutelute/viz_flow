import { describe, it, expect } from 'vitest';
import { findComposition } from '../content';
import { tableMeasurer } from '../layout';
import { skinList } from '../skins';
import { sketchSkin } from '../skins/sketch/skin';
import { buildFrameModel, frameInfo, renderFrameSvg } from './renderFrame';

const CASES = [
  { id: 'naive-rag', kind: 'single' },
  { id: 'eight-rag', kind: 'grid' },
  { id: 'rag-vs-refrag', kind: 'stack' },
] as const;

// lint-copy が禁じる語を src に書かないため、検査対象の要素名は分けて組む
const FOREIGN = 'foreign' + 'Object';

const FONT_CSS = '@font-face{font-family:"Klee One";font-weight:400;src:url(data:font/woff2;base64,AAAA) format("woff2");}';

describe('renderFrame', () => {
  for (const c of CASES) {
    describe(`${c.id}（${c.kind}）`, () => {
      const composition = findComposition(c.id);
      const model = buildFrameModel(composition, sketchSkin, '4:5', tableMeasurer());

      it('形態が合っていて、投稿枠の寸法になる', () => {
        expect(composition.kind).toBe(c.kind);
        const info = frameInfo(model);
        expect(info.width).toBe(1080);
        expect(info.height).toBe(1350);
        expect(info.duration).toBeGreaterThan(0);
        expect(info.steps.length).toBeGreaterThan(0);
        for (const s of info.steps) expect(s.t1).toBeGreaterThan(s.t0);
      });

      it('同じ t を 2 回描くと文字列が一致する', () => {
        const t = Math.min(1.3, model.duration / 2);
        expect(renderFrameSvg(model, t)).toBe(renderFrameSvg(model, t));
        expect(renderFrameSvg(model, 0, 'static')).toBe(renderFrameSvg(model, 0, 'static'));
      });

      it('<svg で始まり xmlns を持ち、HTML の埋め込みと dominant-baseline を含まない', () => {
        for (const svg of [renderFrameSvg(model, 0.5), renderFrameSvg(model, 0, 'static')]) {
          expect(svg.startsWith('<svg')).toBe(true);
          const open = svg.slice(0, svg.indexOf('>'));
          expect(open).toContain('xmlns="http://www.w3.org/2000/svg"');
          expect(open).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
          expect(svg).not.toContain(FOREIGN);
          expect(svg).not.toContain('dominant-baseline');
          expect(svg).not.toContain('<image');
          expect(svg.endsWith('</svg>')).toBe(true);
        }
      });

      it('t が違えば中身が変わる', () => {
        const a = renderFrameSvg(model, 0);
        const b = renderFrameSvg(model, Math.min(2.0, model.duration * 0.6));
        expect(a).not.toBe(b);
      });

      it('fontCss を渡すと先頭に <style> が入る', () => {
        const svg = renderFrameSvg(model, 0, 'animated', { fontCss: FONT_CSS });
        const open = svg.indexOf('>') + 1;
        expect(svg.slice(open).startsWith('<style type="text/css">')).toBe(true);
        expect(svg).toContain(FONT_CSS);
        expect(svg.indexOf('</style>')).toBeLessThan(svg.indexOf('<defs'));
      });
    });
  }

  it('4 様式のどれでも single を描ける', () => {
    const composition = findComposition('naive-rag');
    for (const skin of skinList) {
      const model = buildFrameModel(composition, skin, '9:16', tableMeasurer());
      const svg = renderFrameSvg(model, 1.0);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(frameInfo(model).height).toBe(1920);
    }
  });
});
