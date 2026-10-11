import { useEffect, useRef, useState } from 'react';
import type { CompiledStep } from '../timeline/types';
import { S } from './strings';
import { useDialog } from './use-dialog';
import { CloseIcon } from './Icons';
import type { ExportJob } from './use-export';
import {
  EXPORT_SIZES,
  exportCommand,
  exportFileName,
  type ExportFormat,
  type ExportQuality,
  type ExportRequest,
  type ExportSize,
} from './export-command';

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  templateId: string;
  styleId: string;
  steps: CompiledStep[];
  duration: number;
  /** いまの再生位置（秒） */
  currentT: number;
  /**
   * ブラウザ内で書き出す処理。無ければ端末用のコマンドを組み立てて見せる。
   * src/export/run.ts が入ったらここに差し込む。
   */
  onExport?: (req: ExportRequest) => void | Promise<void>;
  /** ブラウザ内書き出しの進捗と結果 */
  job?: ExportJob;
  onCancel?: () => void;
  onDownload?: () => void;
  onShare?: () => Promise<boolean>;
  onRetryWithoutFonts?: () => void;
  canShare?: boolean;
}

const LOOPS = [1, 2, 3];
const SHOW_MS = 2000;

export function ExportDialog(props: ExportDialogProps) {
  const { open, onClose, templateId, styleId, steps, duration, currentT, onExport, job, onCancel, onDownload, onShare, onRetryWithoutFonts, canShare } = props;
  const [shareNote, setShareNote] = useState('');
  const running = job?.phase === 'running';
  const ref = useDialog(open, onClose);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [size, setSize] = useState<ExportSize>('4x5');
  const [atMode, setAtMode] = useState<'now' | number>('now');
  const [loops, setLoops] = useState(1);
  const [quality, setQuality] = useState<ExportQuality>('normal');
  const [outDir, setOutDir] = useState('out');
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const req: ExportRequest = {
    templateId,
    styleId,
    format,
    size,
    outDir,
    ...(format === 'png'
      ? atMode === 'now'
        ? { at: Number(currentT.toFixed(2)) }
        : { step: atMode }
      : { loops, quality }),
  };
  const command = exportCommand(req);
  const stepNumbers = steps.map((s) => s.n).filter((n, i, arr) => arr.indexOf(n) === i);

  const run = async () => {
    if (onExport) {
      await onExport(req);
      return;
    }
    setShown(true);
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), SHOW_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog ref={ref} className="dlg" aria-labelledby="export-title">
      <div className="dlg__head">
        <h2 id="export-title" className="dlg__title">
          {S.export.title}
        </h2>
        <button type="button" className="ui-btn ui-btn--icon" aria-label={S.export.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="dlg__body">
        <fieldset className="dlg__row dlg__fieldset">
          <legend>{S.export.format}</legend>
          <div className="dlg__radios">
            <label className="ui-check">
              <input type="radio" name="export-format" checked={format === 'png'} onChange={() => setFormat('png')} />
              {S.export.png}
            </label>
            <label className="ui-check">
              <input type="radio" name="export-format" checked={format === 'mp4'} onChange={() => setFormat('mp4')} />
              {S.export.mp4}
            </label>
          </div>
        </fieldset>

        <div className="dlg__row">
          <label className="dlg__label" htmlFor="export-size">
            {S.export.size}
          </label>
          <select id="export-size" className="ui-select" value={size} onChange={(e) => setSize(e.target.value as ExportSize)}>
            {EXPORT_SIZES.map((s) => (
              <option key={s} value={s}>
                {S.export.sizes[s]}
              </option>
            ))}
          </select>
        </div>

        {format === 'png' ? (
          <div className="dlg__row">
            <label className="dlg__label" htmlFor="export-at">
              {S.export.at}
            </label>
            <select
              id="export-at"
              className="ui-select"
              value={atMode === 'now' ? 'now' : String(atMode)}
              onChange={(e) => setAtMode(e.target.value === 'now' ? 'now' : Number(e.target.value))}
            >
              <option value="now">{S.export.atNow}</option>
              {stepNumbers.map((n) => (
                <option key={n} value={n}>
                  {S.export.atStep(n)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="dlg__row">
              <label className="dlg__label" htmlFor="export-loops">
                {S.export.length}
              </label>
              <select id="export-loops" className="ui-select" value={loops} onChange={(e) => setLoops(Number(e.target.value))}>
                {LOOPS.map((n) => (
                  <option key={n} value={n}>
                    {S.export.loops(n, duration * n)}
                  </option>
                ))}
              </select>
            </div>
            <div className="dlg__row">
              <label className="dlg__label" htmlFor="export-quality">
                {S.export.quality}
              </label>
              <select id="export-quality" className="ui-select" value={quality} onChange={(e) => setQuality(e.target.value as ExportQuality)}>
                <option value="normal">{S.export.qNormal}</option>
                <option value="high">{S.export.qHigh}</option>
              </select>
            </div>
          </>
        )}

        {!onExport && (
          <div className="dlg__row">
            <label className="dlg__label" htmlFor="export-out">
              {S.export.outDir}
            </label>
            <input id="export-out" className="dlg__input" type="text" value={outDir} onChange={(e) => setOutDir(e.target.value)} />
          </div>
        )}

        <div className="dlg__row">
          <span className="dlg__label">{S.export.fileName}</span>
          <span>{exportFileName(req)}</span>
        </div>

        {job && job.phase !== 'idle' && (
          <div className="dlg__status" aria-live="polite">
            {job.phase === 'running' && job.progress && (
              <>
                <p className="ui-note">
                  {S.export.running}。{S.export.phase[job.progress.phase]}。{S.export.stayOnTab}
                </p>
                <progress className="dlg__progress" max={job.progress.total} value={job.progress.done} />
                <p className="ui-status">
                  {job.progress.phase === 'fonts' ? '' : S.export.progress(job.progress.done, job.progress.total, Math.round(job.progress.etaSec ?? 0))}
                </p>
                <p className="ui-field dlg__actions">
                  <button type="button" className="ui-btn" onClick={onCancel}>
                    {S.export.cancel}
                  </button>
                </p>
              </>
            )}
            {job.phase === 'done' && job.result && (
              <>
                <p className="ui-note">
                  {S.export.done}: {job.result.filename}
                  {job.result.fallback ? `（${S.export.fallbackWebm}）` : ''}
                </p>
                <p className="ui-field dlg__actions">
                  <button type="button" className="ui-btn ui-btn--primary" onClick={onDownload}>
                    {S.export.download}
                  </button>
                  {canShare && onShare && (
                    <button
                      type="button"
                      className="ui-btn"
                      onClick={async () => setShareNote((await onShare()) ? S.export.shared : S.export.shareFailed)}
                    >
                      {S.export.share}
                    </button>
                  )}
                  <span className="ui-status">{shareNote}</span>
                </p>
              </>
            )}
            {job.phase === 'error' && job.error && (
              <>
                <p className="ui-note">
                  {job.error.code === 'aborted'
                    ? S.export.aborted
                    : job.error.code === 'font-fetch-failed'
                      ? S.export.fontFail
                      : job.error.code === 'no-video-encoder'
                        ? S.export.noH264
                        : `${S.export.failed}: ${job.error.message}`}
                </p>
                {job.error.code === 'font-fetch-failed' && onRetryWithoutFonts && (
                  <p className="ui-field dlg__actions">
                    <button type="button" className="ui-btn" onClick={onRetryWithoutFonts}>
                      {S.export.retryNoFonts}
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {shown && !onExport && (
          <div>
            <p className="ui-note">{S.export.commandNote}</p>
            <pre className="dlg__code" aria-label={S.export.command}>{command}</pre>
            <p className="ui-field dlg__actions">
              <button type="button" className="ui-btn" onClick={copyCommand}>
                {S.export.copyCommand}
              </button>
              <span className="ui-status" role="status" aria-live="polite">
                {copied ? S.export.commandCopied : ''}
              </span>
            </p>
          </div>
        )}
      </div>
      <div className="dlg__foot">
        <button type="button" className="ui-btn" onClick={onClose}>
          {S.export.close}
        </button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={run} disabled={running}>
          {S.export.run}
        </button>
      </div>
    </dialog>
  );
}
