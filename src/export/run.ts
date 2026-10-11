import type { Composition } from '../model/diagram';
import type { FrameAspect } from '../layout/types';
import { canvasMeasurer } from '../layout';
import type { Skin } from '../skins/types';
import type { FrameState } from '../timeline/types';
import { buildFrameModel, renderFrameSvg, type FrameModel } from '../render/renderFrame';
import { ExportError, throwIfAborted } from './errors';
import { collectFrameText, collectModelText, ensureSkinFonts, fontCssFor, missingFamilies, uniqueChars } from './fonts';
import { exportPng } from './png';
import { BITRATE_NORMAL, canExportMp4, exportMp4 } from './mp4';
import { canExportMediaRecorder, canExportWebm, exportWebm, exportWebmMediaRecorder } from './webm';
import type { EncodeJob } from './encode';

// 書き出しの司令塔。フォント埋め込み、形式ごとの分岐、進捗と中止をここで束ねる。
// 描画そのものは render/renderFrame に任せ、ここでは t を決めて呼ぶだけにする。

export type ExportFormat = 'png' | 'mp4' | 'svg';

export interface ExportOptions {
  composition: Composition;
  skin: Skin;
  frame: FrameAspect;
  format: ExportFormat;
  /** png / svg の時刻（秒）。省略時は 0 */
  t?: number;
  /** png / svg の描き方。省略時は animated */
  mode?: FrameState['mode'];
  /** mp4 の周回数。省略時は 1 */
  loops?: number;
  /** 省略時は 30 */
  fps?: number;
  /** bit/s。省略時は 8e6 */
  bitrate?: number;
  /** false ならフォントを埋め込まない（取得に失敗した後の再実行用） */
  embedFonts?: boolean;
}

export type ExportPhase = 'fonts' | 'render' | 'encode' | 'finalize';

export interface ExportProgress {
  done: number;
  total: number;
  phase: ExportPhase;
  etaSec?: number;
}

export type ExportFallback = 'webm' | 'mediarecorder';

export interface ExportResult {
  blob: Blob;
  filename: string;
  mime: string;
  /** mp4 を頼まれたが H.264 が無く、別の形式になったとき */
  fallback?: ExportFallback;
}

const DEFAULT_FPS = 30;

export function frameKey(frame: FrameAspect): string {
  return frame === 'free' ? 'free' : frame.replace(':', 'x');
}

export function suggestFilename(opts: Pick<ExportOptions, 'composition' | 'skin' | 'frame' | 'format' | 't'>, ext?: string): string {
  const base = `${opts.composition.id}_${opts.skin.id}_${frameKey(opts.frame)}`;
  const e = ext ?? (opts.format === 'mp4' ? 'mp4' : opts.format);
  if (opts.format !== 'mp4' && opts.t != null && opts.t > 0) return `${base}_t${Number(opts.t.toFixed(2))}.${e}`;
  return `${base}.${e}`;
}

function etaOf(startedAt: number, done: number, total: number): number | undefined {
  if (done <= 0) return undefined;
  const elapsed = (performance.now() - startedAt) / 1000;
  return Math.max(0, (elapsed / done) * (total - done));
}

async function fontCssOf(model: FrameModel, opts: ExportOptions, report: (p: ExportProgress) => void): Promise<string | undefined> {
  if (opts.embedFonts === false) return undefined;
  report({ done: 0, total: 1, phase: 'fonts' });
  const text = uniqueChars(collectModelText(model) + collectFrameText(model));
  const css = await fontCssFor(model.skin, text);
  const probe = renderFrameSvg(model, 0, 'animated');
  const missing = missingFamilies(probe, css);
  if (missing.length > 0) {
    throw new ExportError('font-fetch-failed', `フォントを埋め込めなかった: ${missing.join(', ')}`);
  }
  report({ done: 1, total: 1, phase: 'fonts' });
  return css;
}

async function pickVideo(model: FrameModel, fps: number, bitrate: number): Promise<{ run: (job: EncodeJob) => Promise<Blob>; ext: string; fallback?: ExportFallback }> {
  const { width, height } = model.size;
  if (await canExportMp4(width, height, fps, bitrate)) return { run: exportMp4, ext: 'mp4' };
  if (await canExportWebm(width, height, fps, bitrate)) return { run: exportWebm, ext: 'webm', fallback: 'webm' };
  if (canExportMediaRecorder()) return { run: exportWebmMediaRecorder, ext: 'webm', fallback: 'mediarecorder' };
  throw new ExportError('no-video-encoder', 'このブラウザは動画を作れない。Chrome か Edge を使うか、PNG で書き出す');
}

/**
 * ブラウザ内で書き出す。進捗はフレームごとに onProgress に届き、signal で中止できる。
 * フォントの取得に失敗したら code 'font-fetch-failed' を投げる。UI は embedFonts: false で再実行できる。
 */
export async function runExport(opts: ExportOptions, onProgress?: (p: ExportProgress) => void, signal?: AbortSignal): Promise<ExportResult> {
  const report = (p: ExportProgress) => onProgress?.(p);
  throwIfAborted(signal);

  await ensureSkinFonts(opts.skin);
  const model = buildFrameModel(opts.composition, opts.skin, opts.frame, canvasMeasurer());
  const fontCss = await fontCssOf(model, opts, report);
  throwIfAborted(signal);

  const t = opts.t ?? 0;
  const mode = opts.mode ?? 'animated';

  if (opts.format === 'svg') {
    report({ done: 0, total: 1, phase: 'render' });
    const svg = renderFrameSvg(model, t, mode, { fontCss });
    report({ done: 1, total: 1, phase: 'render' });
    return { blob: new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename: suggestFilename(opts), mime: 'image/svg+xml' };
  }

  if (opts.format === 'png') {
    report({ done: 0, total: 1, phase: 'render' });
    const blob = await exportPng(model, { t, mode, fontCss });
    throwIfAborted(signal);
    report({ done: 1, total: 1, phase: 'render' });
    return { blob, filename: suggestFilename(opts), mime: 'image/png' };
  }

  const fps = opts.fps ?? DEFAULT_FPS;
  const bitrate = opts.bitrate ?? BITRATE_NORMAL;
  const loops = Math.max(1, Math.round(opts.loops ?? 1));
  const picked = await pickVideo(model, fps, bitrate);
  const startedAt = performance.now();
  const blob = await picked.run({
    model,
    fps,
    loops,
    bitrate,
    fontCss,
    signal,
    onFrame: (done, total) => report({ done, total, phase: 'encode', etaSec: etaOf(startedAt, done, total) }),
    onFinalize: () => report({ done: 1, total: 1, phase: 'finalize' }),
  });
  return { blob, filename: suggestFilename(opts, picked.ext), mime: blob.type, fallback: picked.fallback };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 共有シートに渡す。iPhone では「写真」に直接保存できる。使えない環境では false。 */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch {
    return false;
  }
}
