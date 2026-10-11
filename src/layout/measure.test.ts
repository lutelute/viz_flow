import { describe, it, expect } from 'vitest';
import { tableMeasurer, wrapJa, type FontSpec } from './measure';

const measurer = tableMeasurer();
const font: FontSpec = { family: 'sans-serif', size: 10, weight: 400 };
const em = (n: number) => n * font.size;

const LINE_START_FORBIDDEN = Array.from('、。，．・」』）］｝！？ー〜…');
const LINE_END_FORBIDDEN = Array.from('「『（［｛');

describe('wrapJa', () => {
  it('手動改行は常に行を分ける', () => {
    expect(wrapJa('ベクトル\nDB', em(100), measurer, font)).toEqual(['ベクトル', 'DB']);
  });

  it('句読点を行頭に置かない', () => {
    const lines = wrapJa('こんにちは、世界。また会う日まで、さようなら。', em(5), measurer, font);
    for (const line of lines) {
      expect(LINE_START_FORBIDDEN).not.toContain(Array.from(line)[0]);
      expect(measurer.width(line, font.family, font.size)).toBeLessThanOrEqual(em(5) + 1e-6);
    }
    expect(lines.join('')).toBe('こんにちは、世界。また会う日まで、さようなら。');
  });

  it('開き括弧を行末に置かない', () => {
    const lines = wrapJa('これは「テスト」です。あれも（例）です', em(4), measurer, font);
    for (const line of lines) {
      const chars = Array.from(line);
      expect(LINE_END_FORBIDDEN).not.toContain(chars[chars.length - 1]);
      expect(LINE_START_FORBIDDEN).not.toContain(chars[0]);
    }
    expect(lines.join('')).toBe('これは「テスト」です。あれも（例）です');
  });

  it('長音と三点リーダも行頭に置かない', () => {
    const lines = wrapJa('データベース…サーバー', em(5), measurer, font);
    for (const line of lines) expect(LINE_START_FORBIDDEN).not.toContain(Array.from(line)[0]);
  });

  it('半角の英単語は途中で切らない', () => {
    const text = 'use the embedding model now';
    const lines = wrapJa(text, em(6), measurer, font);
    const words = new Set(text.split(' '));
    for (const line of lines) {
      for (const w of line.split(' ')) expect(words).toContain(w);
    }
    expect(lines.join(' ')).toBe(text);
  });

  it('1 語で収まらないときだけ字で割る', () => {
    const lines = wrapJa('abcdefghijklmnop', em(3), measurer, font);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('abcdefghijklmnop');
    for (const line of lines) expect(measurer.width(line, font.family, font.size)).toBeLessThanOrEqual(em(3) + 1e-6);
  });

  it('収まる文はそのまま 1 行', () => {
    expect(wrapJa('埋め込みモデル', em(10), measurer, font)).toEqual(['埋め込みモデル']);
  });
});
