import { describe, expect, it } from 'vitest';
import { plainDarkSkin, plainSkin } from './skin';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// 字に使う色は地と帯の両方に 4.5:1、線は 3:1（WCAG 1.4.3 と 1.4.11）
describe.each([plainSkin, plainDarkSkin])('略図の色: $id', (skin) => {
  const t = skin.tokens;
  const grounds = [t.bg, t.bg2];
  const text = { ink: t.ink, inkSoft: t.inkSoft, accent1: t.tone.accent1, accent2: t.tone.accent2, accent3: t.tone.accent3 };

  it.each(Object.entries(text))('字 %s は 4.5:1 以上', (_k, color) => {
    for (const g of grounds) expect(contrast(color, g)).toBeGreaterThanOrEqual(4.5);
  });

  it('線は 3:1 以上', () => {
    for (const g of grounds) expect(contrast(t.line, g)).toBeGreaterThanOrEqual(3);
  });

  it('処理中の丸（墨の面）の上のアイコンは 4.5:1 以上', () => {
    expect(contrast(t.bg, t.ink)).toBeGreaterThanOrEqual(4.5);
  });
});
