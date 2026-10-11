// 書き出しで起きる失敗。UI は code で分岐し、文言は UI 側が持つ。

export type ExportErrorCode =
  | 'font-fetch-failed'
  | 'tainted-canvas'
  | 'svg-decode-failed'
  | 'canvas-unavailable'
  | 'no-video-encoder'
  | 'encode-failed'
  | 'aborted';

export class ExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(code: ExportErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ExportError';
    this.code = code;
  }
}

export function isExportError(e: unknown, code?: ExportErrorCode): e is ExportError {
  return e instanceof ExportError && (code === undefined || e.code === code);
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExportError('aborted', '書き出しを中止した');
}
