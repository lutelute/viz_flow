import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, type VideoCodec } from 'mediabunny';
import type { FrameModel } from '../render/renderFrame';
import { renderFrameSvg } from '../render/renderFrame';
import { ExportError, throwIfAborted } from './errors';
import { frameCount, frameTime } from './frames';
import { makeCanvas, svgToCanvas } from './rasterize';

// mediabunny で canvas を 1 フレームずつ WebCodecs に流す共通の輪。
// source.add を await するのが背圧になり、メモリが膨らまない。

export interface EncodeJob {
  model: FrameModel;
  fps: number;
  loops: number;
  /** bit/s */
  bitrate: number;
  fontCss?: string;
  signal?: AbortSignal;
  onFrame?: (done: number, total: number) => void;
  /** フレームを描き終えて finalize に入る前に呼ぶ */
  onFinalize?: () => void;
}

export type Container = 'mp4' | 'webm';

const MIME: Record<Container, string> = { mp4: 'video/mp4', webm: 'video/webm' };

export async function encodeFrames(job: EncodeJob, container: Container, codec: VideoCodec): Promise<Blob> {
  const { width, height } = job.model.size;
  const canvas = makeCanvas(width, height);
  const format = container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(canvas, {
    codec,
    quality: new Quality({ bitrate: job.bitrate }),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: job.fps });

  const total = frameCount(job.model.duration, job.fps, job.loops);
  try {
    throwIfAborted(job.signal);
    await output.start();
    for (let i = 0; i < total; i++) {
      throwIfAborted(job.signal);
      const svg = renderFrameSvg(job.model, frameTime(i, job.fps, job.model.duration), 'animated', { fontCss: job.fontCss });
      await svgToCanvas(svg, width, height, canvas);
      await source.add(i / job.fps, 1 / job.fps);
      job.onFrame?.(i + 1, total);
    }
    source.close();
    job.onFinalize?.();
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    if (e instanceof ExportError) throw e;
    throw new ExportError('encode-failed', `${container} の書き出しに失敗した`, { cause: e });
  }
  const buffer = target.buffer;
  if (!buffer) throw new ExportError('encode-failed', '出力バッファが空だった');
  return new Blob([buffer], { type: MIME[container] });
}
