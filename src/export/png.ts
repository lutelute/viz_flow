import type { FrameModel } from '../render/renderFrame';
import { renderFrameSvg } from '../render/renderFrame';
import type { FrameState } from '../timeline/types';
import { canvasToBlob, svgToCanvas } from './rasterize';

export interface PngOptions {
  t: number;
  mode?: FrameState['mode'];
  fontCss?: string;
  canvas?: HTMLCanvasElement;
}

/** 1 フレームを PNG にする。寸法は model の投稿枠そのまま（1080×1350 など）。 */
export async function exportPng(model: FrameModel, opts: PngOptions): Promise<Blob> {
  const svg = renderFrameSvg(model, opts.t, opts.mode ?? 'animated', { fontCss: opts.fontCss });
  const canvas = await svgToCanvas(svg, model.size.width, model.size.height, opts.canvas);
  return canvasToBlob(canvas, 'image/png');
}
