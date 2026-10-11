import { embedFontsCss, loadSkinFonts } from '../skins/fonts';
import { fnv1a, type Skin } from '../skins/types';
import type { FrameModel } from '../render/renderFrame';
import { renderFrameSvg } from '../render/renderFrame';
import { ExportError } from './errors';

// SVG を <img> 経由で canvas に描くと、ページが読み込んだ Web フォントは見えない。
// そのため使う文字を含む woff2 だけを base64 の @font-face にして SVG に埋め込む。

const CACHE_NAME = 'vizflow-fonts-v1';
const memory = new Map<string, Promise<string>>();

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[body] ?? m;
  });
}

/** SVG 文字列から、表示される文字だけを重複なしで集める。<style> の中身とタグは捨てる。 */
export function collectText(svg: string): string {
  const withoutStyle = svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  const text = decodeEntities(withoutStyle.replace(/<[^>]*>/g, ''));
  return uniqueChars(text);
}

export function uniqueChars(text: string): string {
  const set = new Set<string>();
  for (const ch of text) if (!/\s/.test(ch)) set.add(ch);
  return [...set].sort().join('');
}

/** 図の定義に書かれた全文字。どの t でも出ない文字は無いので、これと数フレームの描画結果を合わせれば十分になる。 */
export function collectModelText(model: FrameModel): string {
  const parts: string[] = [];
  const c = model.composition;
  if (c.kind !== 'single') parts.push(c.title);
  if (c.kind === 'stack') for (const it of c.items) parts.push(it.heading);
  for (const cell of model.cells) {
    const d = cell.diagram;
    parts.push(d.title, d.subtitle ?? '');
    for (const l of d.lanes) parts.push(l.label ?? '');
    for (const n of d.nodes) parts.push(n.label, n.sublabel ?? '');
    for (const e of d.edges) parts.push(e.label ?? '');
    for (const g of d.groups ?? []) parts.push(g.label ?? '');
    for (const s of d.steps) {
      parts.push(String(s.n), s.short ?? '', s.caption, s.detail ?? '');
      for (const a of s.actions) {
        if ('payload' in a && a.payload.label) parts.push(a.payload.label);
        if (a.type === 'split') for (const x of a.into) parts.push(x.payload.label ?? '');
        if (a.type === 'merge') parts.push(a.into.payload.label ?? '');
        if (a.type === 'dwell') parts.push(a.label ?? '');
      }
    }
    for (const s of d.sources) parts.push(s.title, s.authors, String(s.year), s.venue ?? '', s.arxiv ?? '', s.doi ?? '', s.note ?? '');
  }
  for (const s of model.steps) parts.push(s.caption);
  return uniqueChars(parts.join(''));
}

/** 静止表示と各ステップの途中を描いて、スキンが足す文字（丸数字、「出典」など）も拾う。 */
export function collectFrameText(model: FrameModel): string {
  const parts = [collectText(renderFrameSvg(model, 0, 'static')), collectText(renderFrameSvg(model, 0, 'animated'))];
  for (const s of model.steps) parts.push(collectText(renderFrameSvg(model, (s.t0 + s.t1) / 2, 'animated')));
  parts.push(collectText(renderFrameSvg(model, Math.max(0, model.duration - 0.05), 'animated')));
  return uniqueChars(parts.join(''));
}

export function textKey(skin: Skin, text: string): string {
  const fonts = skin.fonts.map((f) => `${f.googleId}:${f.weights.join(',')}`).join('|');
  return `${skin.id}-${fnv1a(fonts).toString(16)}-${fnv1a(text).toString(16)}`;
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

function cacheUrl(key: string): string {
  const origin = typeof location !== 'undefined' ? location.origin : 'https://vizflow.invalid';
  return `${origin}/vizflow-fonts/${key}.css`;
}

async function fetchAndStore(skin: Skin, text: string, key: string): Promise<string> {
  const cache = await openCache();
  const url = cacheUrl(key);
  if (cache) {
    const hit = await cache.match(url).catch(() => undefined);
    if (hit) return hit.text();
  }
  let css: string;
  try {
    css = await embedFontsCss(skin.fonts, text);
  } catch (e) {
    throw new ExportError('font-fetch-failed', 'フォントを取得できなかった。ネットワークか拡張機能が Google Fonts を止めている', { cause: e });
  }
  if (!css) throw new ExportError('font-fetch-failed', 'Google Fonts の CSS に使える @font-face が無かった');
  if (cache) await cache.put(url, new Response(css, { headers: { 'content-type': 'text/css' } })).catch(() => undefined);
  return css;
}

/**
 * スキンのフォントのうち text の文字を含むスライスを @font-face の CSS にする。
 * 同じ skin と文字集合なら Cache API と メモリから返す。失敗は code 'font-fetch-failed'。
 */
export function fontCssFor(skin: Skin, text: string): Promise<string> {
  const key = textKey(skin, uniqueChars(text));
  let p = memory.get(key);
  if (!p) {
    p = fetchAndStore(skin, text, key);
    p.catch(() => memory.delete(key));
    memory.set(key, p);
  }
  return p;
}

/** SVG が使う font-family のうち、CSS に @font-face が無いもの。空なら全部埋め込めている。 */
export function missingFamilies(svg: string, css: string): string[] {
  const have = new Set<string>();
  for (const m of css.matchAll(/font-family:\s*["']?([^;"']+)["']?\s*;/g)) have.add(m[1].trim());
  const used = new Set<string>();
  for (const m of svg.matchAll(/font-family="([^"]*)"/g)) {
    for (const fam of decodeEntities(m[1]).split(',')) {
      const name = fam.trim().replace(/^["']|["']$/g, '');
      if (name) used.add(name);
    }
  }
  return [...used].filter((f) => !have.has(f));
}

/** 画面側と同じフォントで文字幅を測れるよう、書き出し前に読み込みを待つ。 */
export async function ensureSkinFonts(skin: Skin, timeoutMs = 4000): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  loadSkinFonts(skin);
  const sample = 'あ漢字カナ Lewis 0123（）、。';
  const loads = skin.fonts.flatMap((f) => f.weights.map((w) => document.fonts.load(`${w} 16px "${f.family}"`, sample)));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]).catch(() => undefined);
}
