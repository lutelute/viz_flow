import { canEncodeVideo, Quality } from 'mediabunny';
import { encodeFrames, type EncodeJob } from './encode';
import { BITRATE_NORMAL } from './bitrate';

// H.264（avc）の MP4。Instagram が受け付ける素直な形。
// 1080×1920 は H.264 Level 4.1 が要るので、寸法込みで対応を確かめる。

export { BITRATE_NORMAL, BITRATE_HIGH } from './bitrate';

export function canExportMp4(width: number, height: number, fps: number, bitrate = BITRATE_NORMAL): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return Promise.resolve(false);
  return canEncodeVideo('avc', { width, height, frameRate: fps, quality: new Quality({ bitrate }) }).catch(() => false);
}

export function exportMp4(job: EncodeJob): Promise<Blob> {
  return encodeFrames(job, 'mp4', 'avc');
}
