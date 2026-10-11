import type { TextMeasurer } from './types';

export interface FontSpec {
  family: string;
  size: number;
  weight: number;
}

/** 行頭に置かない字。句読点、閉じ括弧、長音、三点リーダ */
const NO_LINE_START = new Set(Array.from('、。，．・」』）］｝！？ー〜～…‥〉》】〕,.!?)]}'));
/** 行末に置かない字。開き括弧 */
const NO_LINE_END = new Set(Array.from('「『（［｛〈《【〔([{'));

function isWordChar(ch: string): boolean {
  return /^[A-Za-z0-9_'-]$/.test(ch);
}

function isSpace(ch: string): boolean {
  return /^\s$/.test(ch);
}

/**
 * 1 文字の幅を em で見積もる。
 * 全角と CJK 系の記号は 1.0、半角英字 0.56、数字 0.55、半角記号と空白 0.3。
 */
export function charWidthEm(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0xff61 && cp <= 0xff9f) return 0.5;
  if (cp >= 0x2e80 || (cp >= 0x2010 && cp <= 0x205e)) return 1.0;
  if (cp >= 0x30 && cp <= 0x39) return 0.55;
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return 0.56;
  if (cp > 0x7f) return 0.56;
  return 0.3;
}

/** 平均字幅テーブルで測る。DOM が無い環境（テスト、Worker）でも同じ結果を返す。 */
export function tableMeasurer(): TextMeasurer {
  return {
    width(text, _family, size) {
      let em = 0;
      for (const ch of text) em += charWidthEm(ch);
      return em * size;
    },
  };
}

/** canvas の measureText で測る。canvas が取れなければテーブル実装に切り替える。 */
export function canvasMeasurer(): TextMeasurer {
  const fallback = tableMeasurer();
  if (typeof document === 'undefined') return fallback;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return fallback;
  const c = ctx;
  const cache = new Map<string, number>();
  return {
    width(text, family, size, weight = 400) {
      const key = `${weight}|${size}|${family}|${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      c.font = `${weight} ${size}px "${family}"`;
      const w = c.measureText(text).width;
      cache.set(key, w);
      return w;
    },
  };
}

/**
 * 分割の最小単位。CJK は 1 字ずつ、半角の英数字は語でまとめる。
 * 語の途中では切らないが、1 語で収まらないときだけ字に割る。
 */
function tokenize(paragraph: string): string[] {
  const atoms: string[] = [];
  let word = '';
  for (const ch of paragraph) {
    if (isWordChar(ch)) {
      word += ch;
      continue;
    }
    if (word) {
      atoms.push(word);
      word = '';
    }
    atoms.push(ch);
  }
  if (word) atoms.push(word);
  return atoms;
}

function wrapParagraph(paragraph: string, maxWidth: number, measurer: TextMeasurer, font: FontSpec): string[] {
  const width = (s: string) => measurer.width(s, font.family, font.size, font.weight);
  const atoms = tokenize(paragraph);
  const lines: string[] = [];
  let cur: string[] = [];
  let curW = 0;

  const flush = () => {
    while (cur.length > 0 && isSpace(cur[cur.length - 1])) cur.pop();
    lines.push(cur.join(''));
    cur = [];
    curW = 0;
  };

  let i = 0;
  while (i < atoms.length) {
    const a = atoms[i];
    if (cur.length === 0 && lines.length > 0 && isSpace(a)) {
      i++;
      continue;
    }
    const w = width(a);
    if (cur.length === 0 && w > maxWidth && Array.from(a).length > 1) {
      atoms.splice(i, 1, ...Array.from(a));
      continue;
    }
    if (cur.length === 0 || curW + w <= maxWidth) {
      cur.push(a);
      curW += w;
      i++;
      continue;
    }

    if (NO_LINE_START.has(a)) {
      let k = cur.length - 1;
      while (k > 0 && NO_LINE_START.has(cur[k])) k--;
      if (k > 0) {
        atoms.splice(i, 0, ...cur.splice(k));
        flush();
        continue;
      }
      cur.push(a);
      curW += w;
      i++;
      continue;
    }

    while (cur.length > 1 && NO_LINE_END.has(cur[cur.length - 1])) {
      atoms.splice(i, 0, cur.pop()!);
    }
    flush();
  }
  if (cur.length > 0 || lines.length === 0) flush();
  return lines;
}

/**
 * 日本語向けの折り返し。手動の '\n' は常に行を分け、禁則を守って字単位で詰める。
 * 返り値は <tspan> 1 行ずつの配列。
 */
export function wrapJa(text: string, maxWidth: number, measurer: TextMeasurer, font: FontSpec): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    out.push(...wrapParagraph(paragraph, maxWidth, measurer, font));
  }
  return out;
}

export function maxLineWidth(lines: string[], measurer: TextMeasurer, font: FontSpec): number {
  let w = 0;
  for (const line of lines) w = Math.max(w, measurer.width(line, font.family, font.size, font.weight));
  return w;
}
