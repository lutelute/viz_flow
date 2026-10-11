import { content, findComposition } from '../content';
import { getSkin, skins } from '../skins';
import { canvasMeasurer } from '../layout';
import { buildFrameModel, frameInfo, renderFrameSvg } from '../render/renderFrame';
import { collectText, fontCssFor } from './fonts';
import { canExportMp4 } from './mp4';
import { canExportMediaRecorder, canExportWebm } from './webm';
import { downloadBlob, runExport, shareBlob, suggestFilename } from './run';

// ?export=1&harness=1 のときだけ window に載せる。Playwright から書き出しを呼んで実機検証するため。

export interface ExportHarness {
  run: typeof runExport;
  content: typeof content;
  skins: typeof skins;
  findComposition: typeof findComposition;
  getSkin: typeof getSkin;
  suggestFilename: typeof suggestFilename;
  downloadBlob: typeof downloadBlob;
  shareBlob: typeof shareBlob;
  buildFrameModel: typeof buildFrameModel;
  frameInfo: typeof frameInfo;
  renderFrameSvg: typeof renderFrameSvg;
  canvasMeasurer: typeof canvasMeasurer;
  fontCssFor: typeof fontCssFor;
  collectText: typeof collectText;
  canExportMp4: typeof canExportMp4;
  canExportWebm: typeof canExportWebm;
  canExportMediaRecorder: typeof canExportMediaRecorder;
}

declare global {
  interface Window {
    __vizflowExport?: ExportHarness;
  }
}

export function installExportHarness(): void {
  if (typeof window === 'undefined' || window.__vizflowExport) return;
  window.__vizflowExport = {
    run: runExport,
    content,
    skins,
    findComposition,
    getSkin,
    suggestFilename,
    downloadBlob,
    shareBlob,
    buildFrameModel,
    frameInfo,
    renderFrameSvg,
    canvasMeasurer,
    fontCssFor,
    collectText,
    canExportMp4,
    canExportWebm,
    canExportMediaRecorder,
  };
}
