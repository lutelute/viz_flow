import { ExportError } from './errors';

// SVG 文字列を canvas に描く。Blob を <img> に読ませて drawImage するだけで、
// 背景は SVG 側が塗る。HTML を埋め込む要素や外部 <image> が無ければ canvas は汚れない。

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ExportError('svg-decode-failed', 'SVG を画像として読み込めなかった'));
    img.src = url;
  });
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/**
 * SVG を width×height の canvas に描く。canvas を渡せば同じものに描き直す（動画で毎フレーム使い回す）。
 */
export async function svgToCanvas(svg: string, width: number, height: number, canvas?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const c = canvas ?? makeCanvas(width, height);
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new ExportError('canvas-unavailable', 'canvas の 2D コンテキストが取れなかった');

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return c;
}

/** canvas.toBlob の Promise 版。汚れた canvas の SecurityError は code 'tainted-canvas' にする。 */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new ExportError('encode-failed', `canvas を ${type} にできなかった`));
        },
        type,
        quality,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'SecurityError') {
        reject(new ExportError('tainted-canvas', 'canvas が外部リソースで汚れている。SVG に HTML の埋め込みや外部画像が入っていないか確認すること', { cause: e }));
      } else {
        reject(e);
      }
    }
  });
}
