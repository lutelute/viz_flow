// 書き出しの要求と、それを scripts/export.ts の引数に直す関数。
// ブラウザ内の書き出しが入るまでは、この文字列を端末で実行してもらう。
export type ExportFormat = 'png' | 'mp4';
export type ExportSize = '4x5' | '9x16' | '1x1';
export type ExportQuality = 'normal' | 'high';

export interface ExportRequest {
  templateId: string;
  styleId: string;
  format: ExportFormat;
  size: ExportSize;
  /** png のとき。ステップ番号か秒のどちらか */
  step?: number;
  at?: number;
  /** mp4 のとき */
  loops?: number;
  quality?: ExportQuality;
  outDir: string;
}

export const EXPORT_SIZES: ExportSize[] = ['4x5', '9x16', '1x1'];

const CRF: Record<ExportQuality, number> = { normal: 20, high: 17 };

export function exportFileName(r: ExportRequest): string {
  const base = `${r.templateId}_${r.styleId}_${r.size}`;
  if (r.format === 'mp4') return `${base}.mp4`;
  if (r.step != null) return `${base}_step${r.step}.png`;
  if (r.at != null) return `${base}_t${r.at}.png`;
  return `${base}.png`;
}

export function exportCommand(r: ExportRequest): string {
  const args = ['npm run export --', `--template ${r.templateId}`, `--style ${r.styleId}`, `--size ${r.size}`, `--format ${r.format}`];
  if (r.format === 'png') {
    if (r.step != null) args.push(`--step ${r.step}`);
    else if (r.at != null) args.push(`--at ${r.at}`);
  } else {
    if (r.loops && r.loops !== 1) args.push(`--loops ${r.loops}`);
    args.push(`--crf ${CRF[r.quality ?? 'normal']}`);
  }
  if (r.outDir && r.outDir !== 'out') args.push(`--out ${r.outDir}`);
  return args.join(' ');
}
