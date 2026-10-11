import { useEffect, useRef, useState } from 'react';
import type { CompiledStep } from '../timeline/types';
import { S } from './strings';
import { useDialog } from './use-dialog';
import { CloseIcon } from './Icons';
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
}

const LOOPS = [1, 2, 3];
const SHOW_MS = 2000;

export function ExportDialog(props: ExportDialogProps) {
  const { open, onClose, templateId, styleId, steps, duration, currentT, onExport } = props;
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
        <fieldset className="dlg__row" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="dlg__label" style={{ float: 'left' }}>{S.export.format}</legend>
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
              {steps.map((s) => (
                <option key={s.index} value={s.index + 1}>
                  {S.export.atStep(s.index + 1)}
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

        <div className="dlg__row">
          <label className="dlg__label" htmlFor="export-out">
            {S.export.outDir}
          </label>
          <input id="export-out" className="dlg__input" type="text" value={outDir} onChange={(e) => setOutDir(e.target.value)} />
        </div>

        <div className="dlg__row">
          <span className="dlg__label">{S.export.fileName}</span>
          <span>{exportFileName(req)}</span>
        </div>

        {shown && !onExport && (
          <div>
            <p className="ui-note">{S.export.commandNote}</p>
            <pre className="dlg__code" aria-label={S.export.command}>{command}</pre>
            <p className="ui-field" style={{ marginTop: 8 }}>
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
        <button type="button" className="ui-btn ui-btn--primary" onClick={run}>
          {S.export.run}
        </button>
      </div>
    </dialog>
  );
}
