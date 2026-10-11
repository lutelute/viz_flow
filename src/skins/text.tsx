import type { ReactNode } from 'react';
import type { TextMeasurer } from '../layout/types';
import type { FontFace } from './types';

/** 手動 '\n' を尊重しつつ、幅に収まるように文字単位で折り返す。禁則は layout/measure の wrapJa に任せ、ここは簡易版。 */
export function wrapLines(text: string, maxWidth: number, measure: TextMeasurer, font: FontFace): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      const next = line + ch;
      if (line && measure.width(next, font.family, font.size, font.weight) > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

export interface TextProps {
  x: number;
  y: number;
  lines: string[];
  font: FontFace;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  /** 行間（倍率） */
  leading?: number;
  /** 'top' は y を 1 行目の上端、'middle' は全体の中央、'baseline' は 1 行目のベースライン */
  valign?: 'top' | 'middle' | 'baseline';
  letterSpacing?: number;
  opacity?: number;
}

/** dominant-baseline を使わず dy で揃える（Safari との差を避ける）。 */
export function Text({ x, y, lines, font, fill, anchor = 'start', leading = 1.35, valign = 'top', letterSpacing, opacity }: TextProps): ReactNode {
  const lh = font.size * leading;
  const total = lh * (lines.length - 1) + font.size;
  let first: number;
  if (valign === 'top') first = y + font.size * 0.88;
  else if (valign === 'middle') first = y - total / 2 + font.size * 0.88;
  else first = y;
  return (
    <text
      x={x}
      y={first}
      fontFamily={`"${font.family}"`}
      fontSize={font.size}
      fontWeight={font.weight}
      fill={fill}
      textAnchor={anchor}
      letterSpacing={letterSpacing}
      opacity={opacity}
    >
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function textHeight(lines: number, font: FontFace, leading = 1.35): number {
  return font.size * leading * (lines - 1) + font.size;
}
