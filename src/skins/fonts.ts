import { useEffect, useSyncExternalStore } from 'react';
import type { FontSpec, Skin } from './types';

export type FontStatus = 'loading' | 'ready' | 'fallback';

const FALLBACK_MS = 3000;

export function fontsHref(fonts: FontSpec[]): string {
  const fam = fonts.map((f) => `family=${f.googleId}:wght@${[...f.weights].sort((a, b) => a - b).join(';')}`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=block`;
}

function ensureLink(id: string, href: string) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

async function waitFonts(fonts: FontSpec[]): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  // 欧文・数字・全角括弧のスライスも揃うまで待つ（分割配信のため、ひらがなだけでは足りない）
  const sample = 'あ漢字カナ Lewis 0123（）、。';
  const loads = fonts.flatMap((f) => f.weights.map((w) => document.fonts.load(`${w} 16px "${f.family}"`, sample)));
  await Promise.all(loads);
  await document.fonts.ready;
}

const status = new Map<string, FontStatus>();
const listeners = new Set<() => void>();

function set(id: string, s: FontStatus) {
  status.set(id, s);
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 読み込みを 1 回だけ始める。何度呼んでも 2 回目以降は何もしない。 */
export function loadSkinFonts(skin: Skin): void {
  if (status.has(skin.id)) return;
  status.set(skin.id, 'loading');
  ensureLink(`skin-fonts-${skin.id}`, fontsHref(skin.fonts));
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    set(skin.id, 'fallback');
  }, FALLBACK_MS);
  waitFonts(skin.fonts).then(
    () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      set(skin.id, 'ready');
    },
    () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      set(skin.id, 'fallback');
    },
  );
}

export function fontStatusOf(skin: Skin): FontStatus {
  return status.get(skin.id) ?? 'loading';
}

/** スキンのフォントが使える状態になるまでを追う。 */
export function useSkinFonts(skin: Skin): FontStatus {
  useEffect(() => {
    loadSkinFonts(skin);
  }, [skin]);
  return useSyncExternalStore(subscribe, () => fontStatusOf(skin), () => 'fallback' as const);
}

interface FaceRule { family: string; weight: number; unicodeRange: string; url: string }

function parseFontFaces(css: string): FaceRule[] {
  const out: FaceRule[] = [];
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  for (const b of blocks) {
    const family = /font-family:\s*['"]?([^;'"]+)['"]?;/.exec(b)?.[1]?.trim();
    const weight = Number(/font-weight:\s*(\d+)/.exec(b)?.[1] ?? '400');
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(b)?.[1]?.trim() ?? 'U+0-10FFFF';
    const url = /url\(([^)]+)\)\s*format\(['"]woff2['"]\)/.exec(b)?.[1]?.replace(/['"]/g, '');
    if (family && url) out.push({ family, weight, unicodeRange, url });
  }
  return out;
}

function rangeCovers(range: string, codepoints: Set<number>): boolean {
  for (const part of range.split(',')) {
    const m = /U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?/.exec(part.trim());
    if (!m) continue;
    let lo: number;
    let hi: number;
    if (m[1].includes('?')) {
      lo = parseInt(m[1].replace(/\?/g, '0'), 16);
      hi = parseInt(m[1].replace(/\?/g, 'F'), 16);
    } else {
      lo = parseInt(m[1], 16);
      hi = m[2] ? parseInt(m[2], 16) : lo;
    }
    for (const cp of codepoints) if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const woffCache = new Map<string, Promise<string>>();

/**
 * 書き出し用。使う文字が含まれる unicode-range のスライスだけ woff2 を取り、
 * base64 の @font-face を返す。SVG を <img> 経由で canvas に描くとページのフォントが見えないため。
 */
export async function embedFontsCss(fonts: FontSpec[], text: string): Promise<string> {
  const css = await (await fetch(fontsHref(fonts))).text();
  const faces = parseFontFaces(css);
  const cps = new Set<number>();
  for (const ch of text) cps.add(ch.codePointAt(0)!);
  const needed = faces.filter((f) => rangeCovers(f.unicodeRange, cps));
  const parts = await Promise.all(
    needed.map(async (f) => {
      let p = woffCache.get(f.url);
      if (!p) {
        p = fetch(f.url).then((r) => r.arrayBuffer()).then(toBase64);
        woffCache.set(f.url, p);
      }
      const b64 = await p;
      return `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${f.unicodeRange};}`;
    }),
  );
  return parts.join('\n');
}
