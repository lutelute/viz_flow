import { useCallback, useEffect, useRef, useState } from 'react';
import { findComposition } from '../content';
import { getSkin } from '../skins';
import type { FrameAspect } from '../layout/types';
import { canvasMeasurer } from '../layout';
import { buildFrameModel, frameInfo } from '../render/renderFrame';
import type { ExportErrorCode, ExportOptions, ExportProgress, ExportResult } from '../export';
import { BITRATE_HIGH, BITRATE_NORMAL } from '../export/bitrate';
import { isExportError } from '../export/errors';
import type { ExportRequest, ExportSize } from './export-command';

// ダイアログの要求を src/export の runExport に渡し、進捗・結果・失敗を 1 か所で持つ。
// 書き出しの本体（mediabunny を含む）は重いので、初めて書き出すときに読み込む。

const loadRun = () => import('../export/run');

export type ExportJobPhase = 'idle' | 'running' | 'done' | 'error';

export interface ExportJob {
  phase: ExportJobPhase;
  progress?: ExportProgress;
  result?: ExportResult & { url: string };
  error?: { code: ExportErrorCode | 'unknown'; message: string };
  /** 直前の要求。フォント無しでやり直すときに使う */
  request?: ExportRequest;
}

const FRAME_OF: Record<ExportSize, FrameAspect> = { '4x5': '4:5', '9x16': '9:16', '1x1': '1:1' };

export function toExportOptions(req: ExportRequest, embedFonts = true): ExportOptions {
  const composition = findComposition(req.templateId);
  const skin = getSkin(req.styleId);
  const frame = FRAME_OF[req.size] ?? '4:5';
  let t = req.at ?? 0;
  if (req.format === 'png' && req.step != null) {
    const info = frameInfo(buildFrameModel(composition, skin, frame, canvasMeasurer()));
    const s = info.steps.find((x) => x.n === req.step);
    if (s) t = Math.max(s.t0, s.t1 - 0.02);
  }
  return {
    composition,
    skin,
    frame,
    format: req.format,
    t,
    mode: 'animated',
    loops: req.loops ?? 1,
    bitrate: req.quality === 'high' ? BITRATE_HIGH : BITRATE_NORMAL,
    embedFonts,
  };
}

export function useBrowserExport() {
  const [job, setJob] = useState<ExportJob>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const url = useRef<string | null>(null);

  const release = () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };

  useEffect(() => () => release(), []);

  const start = useCallback(async (req: ExportRequest, embedFonts = true) => {
    abort.current?.abort();
    release();
    const ctl = new AbortController();
    abort.current = ctl;
    setJob({ phase: 'running', request: req, progress: { done: 0, total: 1, phase: 'fonts' } });
    try {
      const { runExport } = await loadRun();
      const result = await runExport(toExportOptions(req, embedFonts), (p) => setJob((j) => (j.phase === 'running' ? { ...j, progress: p } : j)), ctl.signal);
      if (ctl.signal.aborted) return;
      url.current = URL.createObjectURL(result.blob);
      setJob({ phase: 'done', request: req, result: { ...result, url: url.current } });
    } catch (e) {
      if (ctl.signal.aborted) {
        setJob({ phase: 'error', request: req, error: { code: 'aborted', message: '' } });
        return;
      }
      const code = (['font-fetch-failed', 'tainted-canvas', 'svg-decode-failed', 'canvas-unavailable', 'no-video-encoder', 'encode-failed', 'aborted'] as const).find((c) => isExportError(e, c)) ?? 'unknown';
      setJob({ phase: 'error', request: req, error: { code, message: e instanceof Error ? e.message : String(e) } });
    }
  }, []);

  const cancel = useCallback(() => {
    abort.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    release();
    setJob({ phase: 'idle' });
  }, []);

  const download = useCallback(() => {
    if (job.phase === 'done' && job.result) {
      const { blob, filename } = job.result;
      void loadRun().then(({ downloadBlob }) => downloadBlob(blob, filename));
    }
  }, [job]);

  const share = useCallback(async () => {
    if (job.phase === 'done' && job.result) {
      const { shareBlob } = await loadRun();
      return shareBlob(job.result.blob, job.result.filename);
    }
    return false;
  }, [job]);

  const retryWithoutFonts = useCallback(() => {
    if (job.request) void start(job.request, false);
  }, [job.request, start]);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return { job, start, cancel, reset, download, share, retryWithoutFonts, canShare };
}
