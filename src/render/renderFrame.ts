import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Composition, Diagram } from '../model/diagram';
import { diagramsOf } from '../model/diagram';
import { assertValidDiagram } from '../model/validate';
import type { FrameAspect, Size, TextMeasurer } from '../layout/types';
import { resolveLayout } from '../layout';
import { compileTimeline, sampleAt, sampleStatic } from '../timeline';
import type { CompiledStep, FrameState } from '../timeline/types';
import { layoutStyleOf, type Skin } from '../skins/types';
import { DiagramSvg } from './DiagramSvg';
import { buildCompositionCells, compositionDuration, compositionSize, renderComposition, type CompositionCell } from './CompositionView';

// 書き出しと画面が共有する「1 枚の図を描く」契約。
// 時間は t だけで決まり、Math.random や Date.now はこの経路に無い。

export interface RenderRequest {
  composition: Composition;
  skin: Skin;
  t: number;
  mode?: FrameState['mode'];
  frame: FrameAspect;
  measure: TextMeasurer;
}

/** composition 1 つにつき 1 回組む。layout と timeline を持ち、t を変えて何度でも描ける。 */
export interface FrameModel {
  composition: Composition;
  skin: Skin;
  frame: FrameAspect;
  measure: TextMeasurer;
  cells: CompositionCell[];
  size: Size;
  /** 1 周の長さ（秒）。複数の図なら最長のもの */
  duration: number;
  /** パネルや進捗に出すステップ列。複数の図なら最長のもの */
  steps: CompiledStep[];
}

export interface FrameInfo {
  duration: number;
  width: number;
  height: number;
  steps: Array<{ n: number; t0: number; t1: number; caption: string }>;
}

function singleCell(diagram: Diagram, skin: Skin, frame: FrameAspect, measure: TextMeasurer): CompositionCell {
  assertValidDiagram(diagram);
  const layout = resolveLayout(diagram, layoutStyleOf(skin, measure), frame);
  return { diagram, layout, timeline: compileTimeline(diagram, layout) };
}

export function buildFrameModel(composition: Composition, skin: Skin, frame: FrameAspect, measure: TextMeasurer): FrameModel {
  // 単体は投稿枠（題名・キャプション帯・出典）で組む。grid / stack は各図を free で組み、renderComposition が枠に収める
  const cells = composition.kind === 'single' ? [singleCell(diagramsOf(composition)[0], skin, frame, measure)] : buildCompositionCells(composition, skin, measure);
  const longest = cells.reduce((a, b) => (a.timeline.duration >= b.timeline.duration ? a : b));
  return {
    composition,
    skin,
    frame,
    measure,
    cells,
    size: compositionSize(composition, frame, cells),
    duration: compositionDuration(cells),
    steps: longest.timeline.steps,
  };
}

export function frameInfo(model: FrameModel): FrameInfo {
  return {
    duration: model.duration,
    width: model.size.width,
    height: model.size.height,
    steps: model.steps.map((s) => ({ n: s.n, t0: s.t0, t1: s.t1, caption: s.caption })),
  };
}

export function renderFrameElement(model: FrameModel, t: number, mode: FrameState['mode'] = 'animated'): ReactElement {
  const { composition, skin, cells, frame, measure } = model;
  if (composition.kind === 'single') {
    const cell = cells[0];
    const labeledEdges = new Set(cell.diagram.edges.filter((e) => e.label).map((e) => e.id));
    const state = mode === 'static' ? sampleStatic(cell.timeline, { labeledEdges }) : sampleAt(cell.timeline, t);
    return createElement(DiagramSvg, {
      diagram: cell.diagram,
      layout: cell.layout,
      frame: state,
      steps: cell.timeline.steps,
      skin,
      measure,
      showCaption: true,
    });
  }
  return renderComposition({ composition, skin, cells, t, mode, frame, measure });
}

export function renderRequest(req: RenderRequest): ReactElement {
  const model = buildFrameModel(req.composition, req.skin, req.frame, req.measure);
  return renderFrameElement(model, req.t, req.mode ?? 'animated');
}

export interface RenderSvgOptions {
  /** @font-face を並べた CSS。あれば SVG 先頭の <style> に入る */
  fontCss?: string;
}

/**
 * 1 フレームを SVG 文字列にする。xmlns 付きなので、そのまま Blob にして <img> に読ませられる。
 */
export function renderFrameSvg(model: FrameModel, t: number, mode: FrameState['mode'] = 'animated', opts: RenderSvgOptions = {}): string {
  const markup = renderToStaticMarkup(renderFrameElement(model, t, mode));
  const svg = ensureNamespaces(markup);
  if (!opts.fontCss) return svg;
  return injectStyle(svg, opts.fontCss);
}

function ensureNamespaces(svg: string): string {
  if (!svg.startsWith('<svg')) throw new Error('描画結果が <svg> で始まらない');
  const end = svg.indexOf('>');
  let open = svg.slice(0, end);
  if (!/\sxmlns=/.test(open)) open += ' xmlns="http://www.w3.org/2000/svg"';
  if (!/\sxmlns:xlink=/.test(open)) open += ' xmlns:xlink="http://www.w3.org/1999/xlink"';
  return open + svg.slice(end);
}

function injectStyle(svg: string, css: string): string {
  if (css.includes('</style')) throw new Error('fontCss に </style> を含めてはいけない');
  const end = svg.indexOf('>') + 1;
  return `${svg.slice(0, end)}<style type="text/css">${css}</style>${svg.slice(end)}`;
}
