// URL の読み書き。?t=&style=&theme=&step= を書き、?at= ?static=1 ?debug=1 は読むだけ。
// 書き込みは 200ms まとめて replaceState にする。知らない値は既定に戻して黙って無視する。
import { content } from '../content';
import { skinList, type SkinId } from '../skins';

export type ThemeChoice = 'light' | 'dark' | null;

export interface UrlState {
  t: string;
  style: SkinId;
  theme: ThemeChoice;
  /** 1 始まりのステップ番号（一覧の並び順） */
  step: number | null;
  /** 秒。あればその位置で一時停止して開く */
  at: number | null;
  static: boolean;
  debug: boolean;
}

export interface UrlWrite {
  t: string;
  style: SkinId;
  theme: ThemeChoice;
  step: number | null;
  debug: boolean;
}

const DEBOUNCE_MS = 200;

export function defaultTemplateId(): string {
  return content[0].composition.id;
}

export function isTemplateId(id: string | null | undefined): id is string {
  return !!id && content.some((c) => c.composition.id === id);
}

export function isSkinId(id: string | null | undefined): id is SkinId {
  return !!id && skinList.some((s) => s.id === id);
}

function positiveInt(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function seconds(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function readUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  const t = p.get('t');
  const style = p.get('style');
  const theme = p.get('theme');
  return {
    t: isTemplateId(t) ? t : defaultTemplateId(),
    style: isSkinId(style) ? style : skinList[0].id,
    theme: theme === 'light' || theme === 'dark' ? theme : null,
    step: positiveInt(p.get('step')),
    at: seconds(p.get('at')),
    static: p.get('static') === '1',
    debug: p.get('debug') === '1',
  };
}

export function buildSearch(w: UrlWrite): string {
  const p = new URLSearchParams();
  p.set('t', w.t);
  p.set('style', w.style);
  if (w.theme) p.set('theme', w.theme);
  if (w.step != null) p.set('step', String(w.step));
  if (w.debug) p.set('debug', '1');
  return `?${p.toString()}`;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let queued: UrlWrite | null = null;

function commit(): void {
  timer = null;
  if (!queued) return;
  const search = buildSearch(queued);
  queued = null;
  if (typeof window === 'undefined') return;
  if (window.location.search === search) return;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
}

/** 200ms 待ってからまとめて書く。連続した変更は最後の 1 回だけになる。 */
export function scheduleUrlWrite(w: UrlWrite): void {
  queued = w;
  if (timer) clearTimeout(timer);
  timer = setTimeout(commit, DEBOUNCE_MS);
}

/** 共有ボタンのように「いまの URL」が要るときに、待ちを飛ばして書く。 */
export function flushUrlWrite(): void {
  if (timer) clearTimeout(timer);
  commit();
}

export function onPopState(cb: (s: UrlState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb(readUrl(window.location.search));
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
