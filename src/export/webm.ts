import { canEncodeVideo, Quality } from 'mediabunny';
import { renderFrameSvg } from '../render/renderFrame';
import { encodeFrames, type EncodeJob } from './encode';
import { ExportError, throwIfAborted } from './errors';
import { frameCount, frameTime } from './frames';
import { makeCanvas, svgToCanvas } from './rasterize';

// H.264 が無いブラウザ（Firefox など）向け。まず WebCodecs の VP9 を WebM に入れ、
// それも無ければ MediaRecorder に canvas の映像を実時間で流す。

export function canExportWebm(width: number, height: number, fps: number, bitrate: number): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return Promise.resolve(false);
  return canEncodeVideo('vp9', { width, height, frameRate: fps, quality: new Quality({ bitrate }) }).catch(() => false);
}

export function exportWebm(job: EncodeJob): Promise<Blob> {
  return encodeFrames(job, 'webm', 'vp9');
}

const RECORDER_MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

export function canExportMediaRecorder(): boolean {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return false;
  if (!('captureStream' in HTMLCanvasElement.prototype)) return false;
  return RECORDER_MIMES.some((m) => MediaRecorder.isTypeSupported(m));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * MediaRecorder は壁時計で記録するので、1 フレームごとに 1/fps 秒待つ。
 * 12 秒の動画なら 12 秒かかる。最後の手段。
 */
export async function exportWebmMediaRecorder(job: EncodeJob): Promise<Blob> {
  const mime = RECORDER_MIMES.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new ExportError('no-video-encoder', 'このブラウザには使える動画エンコーダが無い');
  const { width, height } = job.model.size;
  const canvas = makeCanvas(width, height);
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: job.bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new ExportError('encode-failed', 'MediaRecorder が失敗した'));
  });

  const total = frameCount(job.model.duration, job.fps, job.loops);
  const frameMs = 1000 / job.fps;
  try {
    const first = renderFrameSvg(job.model, 0, 'animated', { fontCss: job.fontCss });
    await svgToCanvas(first, width, height, canvas);
    recorder.start();
    track.requestFrame();
    for (let i = 0; i < total; i++) {
      throwIfAborted(job.signal);
      const started = performance.now();
      const svg = renderFrameSvg(job.model, frameTime(i, job.fps, job.model.duration), 'animated', { fontCss: job.fontCss });
      await svgToCanvas(svg, width, height, canvas);
      track.requestFrame();
      job.onFrame?.(i + 1, total);
      const spent = performance.now() - started;
      if (spent < frameMs) await sleep(frameMs - spent);
    }
    await sleep(frameMs);
    job.onFinalize?.();
    recorder.stop();
    await stopped;
  } catch (e) {
    if (recorder.state !== 'inactive') recorder.stop();
    track.stop();
    throw e;
  }
  track.stop();
  return new Blob(chunks, { type: recorder.mimeType || mime.split(';')[0] });
}
