import { describe, it, expect } from 'vitest';
import { findComposition } from '../content';
import { tableMeasurer } from '../layout';
import { sketchSkin } from '../skins/sketch/skin';
import { buildFrameModel, renderFrameSvg } from '../render/renderFrame';
import { collectFrameText, collectModelText, collectText, decodeEntities, missingFamilies, uniqueChars } from './fonts';
import { frameCount, frameTime } from './frames';
import { suggestFilename } from './run';

describe('frames', () => {
  it('N = round(D × fps × loops)、最後は (N-1)/fps で D は描かない', () => {
    expect(frameCount(12, 30, 1)).toBe(360);
    expect(frameCount(12, 30, 2)).toBe(720);
    expect(frameCount(0.01, 30, 1)).toBe(1);
    expect(frameTime(0, 30, 12)).toBe(0);
    expect(frameTime(359, 30, 12)).toBeCloseTo(359 / 30);
    expect(frameTime(360, 30, 12)).toBe(0);
    expect(frameTime(361, 30, 12)).toBeCloseTo(1 / 30);
  });

  it('D が fps で割り切れなくても範囲内に収まる', () => {
    const d = 12.35;
    const n = frameCount(d, 30, 2);
    for (let i = 0; i < n; i++) {
      const t = frameTime(i, 30, d);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(d);
    }
  });
});

describe('collectText', () => {
  it('タグと <style> を捨て、実体参照を戻し、重複を除く', () => {
    const svg = '<svg><style>@font-face{font-family:"X"}</style><text>質問 &amp; 答え</text><text>質問</text></svg>';
    expect(collectText(svg)).toBe(uniqueChars('質問&答え'));
    expect(decodeEntities('&lt;&#x27;&#65;')).toBe("<'A");
  });

  it('描いた図から日本語を拾う', () => {
    const model = buildFrameModel(findComposition('naive-rag'), sketchSkin, '4:5', tableMeasurer());
    const chars = collectText(renderFrameSvg(model, 0, 'static'));
    expect(chars).toMatch(/[぀-ヿ一-鿿]/);
    expect(collectModelText(model).length).toBeGreaterThan(20);
    expect(collectFrameText(model).length).toBeGreaterThan(20);
  });
});

describe('missingFamilies', () => {
  it('SVG が使う family が CSS に無ければ挙げる', () => {
    const model = buildFrameModel(findComposition('naive-rag'), sketchSkin, '4:5', tableMeasurer());
    const svg = renderFrameSvg(model, 0);
    const missing = missingFamilies(svg, '@font-face{font-family:"Klee One";src:url(x);}');
    expect(missing).not.toContain('Klee One');
    const all = sketchSkin.fonts.map((f) => `@font-face{font-family:"${f.family}";src:url(x);}`).join('');
    expect(missingFamilies(svg, all)).toEqual([]);
  });
});

describe('suggestFilename', () => {
  const composition = findComposition('naive-rag');
  it('テンプレ_様式_枠.拡張子', () => {
    expect(suggestFilename({ composition, skin: sketchSkin, frame: '4:5', format: 'mp4' })).toBe('naive-rag_sketch_4x5.mp4');
    expect(suggestFilename({ composition, skin: sketchSkin, frame: '9:16', format: 'png' })).toBe('naive-rag_sketch_9x16.png');
    expect(suggestFilename({ composition, skin: sketchSkin, frame: '1:1', format: 'png', t: 3.456 })).toBe('naive-rag_sketch_1x1_t3.46.png');
    expect(suggestFilename({ composition, skin: sketchSkin, frame: '4:5', format: 'mp4' }, 'webm')).toBe('naive-rag_sketch_4x5.webm');
  });
});
