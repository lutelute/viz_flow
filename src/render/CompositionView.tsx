import { useMemo, type ReactElement, type ReactNode } from 'react';
import type { Composition, Diagram } from '../model/diagram';
import { diagramsOf } from '../model/diagram';
import { assertValidDiagram } from '../model/validate';
import type { FrameAspect, Rect, Size, TextMeasurer } from '../layout/types';
import { canvasMeasurer, resolveLayout } from '../layout';
import { compileTimeline, sampleAt, sampleStatic, Transport } from '../timeline';
import type { CompiledTimeline, FrameState } from '../timeline/types';
import { layoutStyleOf, makeCtx, type Skin } from '../skins/types';
import { useSkinFonts } from '../skins/fonts';
import { Text } from '../skins/text';
import { DiagramSvg } from './DiagramSvg';
import { useTransport } from './useTransport';
import { figureBounds } from './fit';
import { OpenHit, type OpenHandlers } from './OpenLayer';

// 複数の図を 1 枚にまとめる形態。grid（8 枚の一覧）と stack（上下の比較）。
// 時計は 1 つで、短い図は末尾で止まる（lockstep）。
// 描画は renderComposition に閉じていて、t と mode を渡せば同じ SVG が返る。

export interface CompositionCell {
  diagram: Diagram;
  layout: ReturnType<typeof resolveLayout>;
  timeline: CompiledTimeline;
}

export interface CompositionModel {
  cells: CompositionCell[];
  transport: Transport;
  fontStatus: ReturnType<typeof useSkinFonts>;
  measure: TextMeasurer;
  /** 全体の長さ（最長の図） */
  duration: number;
}

function freshMeasurer(key: string): TextMeasurer {
  void key;
  return canvasMeasurer();
}

/** 各図を free 枠で組む。hook を使わないので書き出し側からも呼べる。 */
export function buildCompositionCells(composition: Composition, skin: Skin, measure: TextMeasurer): CompositionCell[] {
  return diagramsOf(composition).map((diagram) => {
    assertValidDiagram(diagram);
    const layout = resolveLayout(diagram, layoutStyleOf(skin, measure), 'free');
    return { diagram, layout, timeline: compileTimeline(diagram, layout) };
  });
}

export function compositionDuration(cells: CompositionCell[]): number {
  return Math.max(...cells.map((c) => c.timeline.duration));
}

export function useCompositionModel(composition: Composition, skin: Skin, autoplay: boolean): CompositionModel {
  const fontStatus = useSkinFonts(skin);
  const measure = useMemo(() => freshMeasurer(`${skin.id}:${fontStatus}`), [skin.id, fontStatus]);
  const cells = useMemo(() => buildCompositionCells(composition, skin, measure), [composition, skin, measure]);
  const duration = compositionDuration(cells);
  const transport = useMemo(() => {
    const longest = cells.reduce((a, b) => (a.timeline.duration >= b.timeline.duration ? a : b));
    const merged: CompiledTimeline = { ...longest.timeline, diagramId: composition.id, duration };
    return new Transport(merged, { mode: autoplay ? 'play' : 'static' });
  }, [cells, composition.id, duration, autoplay]);
  return { cells, transport, fontStatus, measure, duration };
}

export const FRAME_SIZE: Record<Exclude<FrameAspect, 'free'>, Size> = {
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

/** grid / stack の外寸。single は図そのものの寸法になる。 */
export function compositionSize(composition: Composition, frame: FrameAspect, cells: CompositionCell[]): Size {
  if (composition.kind === 'single') return cells[0].layout.size;
  if (frame === 'free') return composition.kind === 'grid' ? freeGridSize(composition.columns, cells) : { width: 1080, height: 1400 };
  return FRAME_SIZE[frame];
}

/** 画面で一覧を見るときは横に並べる。高さは中身から決め、余白を作らない。 */
function freeGridSize(columns: number, cells: CompositionCell[]): Size {
  const cols = Math.max(1, Math.min(columns, cells.length));
  const width = cols >= 3 ? 1920 : 1080;
  const cw = (width - GRID.margin * 2 - GRID.gap * (cols - 1)) / cols;
  const scale = Math.min(...cells.map((c) => cw / c.layout.size.width));
  const rows = Math.ceil(cells.length / cols);
  const rowH = Math.max(...cells.map((c) => c.layout.size.height * scale));
  return { width, height: Math.ceil(GRID.titleH + rows * rowH + GRID.gap * (rows - 1) + GRID.citeH + GRID.margin + 8) };
}

const GRID = { margin: 40, titleH: 120, citeH: 56, gap: 24 };

export interface CompositionRenderArgs {
  composition: Composition;
  skin: Skin;
  cells: CompositionCell[];
  t: number;
  mode: FrameState['mode'];
  frame: FrameAspect;
  measure: TextMeasurer;
  debug?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
  /** 画面でだけ使う。セルを押すとその図をひらく */
  open?: OpenHandlers;
}

function cellFrame(cell: CompositionCell, t: number, mode: FrameState['mode']): FrameState {
  return mode === 'static' ? sampleStatic(cell.timeline) : sampleAt(cell.timeline, Math.min(t, cell.timeline.duration - 0.001));
}

/**
 * 構成 1 枚を SVG 要素にする純粋関数。
 * 同じ引数なら同じ要素木を返すので、画面も書き出しもここを通す。
 */
export function renderComposition(args: CompositionRenderArgs): ReactElement {
  const { composition, skin, cells, t: time, mode, frame, measure, debug, width, height, className, open } = args;
  const t = skin.tokens;

  if (composition.kind === 'single') {
    const cell = cells[0];
    return (
      <DiagramSvg
        diagram={cell.diagram}
        layout={cell.layout}
        frame={cellFrame(cell, time, mode)}
        steps={cell.timeline.steps}
        skin={skin}
        measure={measure}
        debug={debug}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  const size = compositionSize(composition, frame, cells);
  const { margin, titleH, citeH } = GRID;
  const body: Rect = { x: margin, y: titleH, width: size.width - margin * 2, height: size.height - titleH - citeH - margin };
  const ctx = makeCtx(skin, composition.id, mode, measure);

  const slots: Array<{ rect: Rect; heading?: string; scale: number; box: Rect }> = [];
  /** セルの図が実際に描かれた範囲。ひらくの当たり判定に使う */
  const drawn: Rect[] = [];
  const boundsOf = (cell: CompositionCell): Rect => {
    const b = figureBounds(cell.layout);
    return b ?? { x: 0, y: 0, width: cell.layout.size.width, height: cell.layout.size.height };
  };
  if (composition.kind === 'grid') {
    // 縦長の投稿枠では 2 列にする。倍率は全セルで揃え、上端を揃えて並べる
    const cols = size.height > size.width ? Math.min(2, composition.columns) : composition.columns;
    const rows = Math.ceil(cells.length / cols);
    const gap = 24;
    const cw = (body.width - gap * (cols - 1)) / cols;
    const ch = (body.height - gap * (rows - 1)) / rows;
    const boxes = cells.map((cell) => ({ x: 0, y: 0, width: cell.layout.size.width, height: cell.layout.size.height }));
    const scale = Math.min(...boxes.map((b) => Math.min(cw / b.width, ch / b.height)));
    cells.forEach((_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const box = boxes[i];
      const rect = { x: body.x + c * (cw + gap), y: body.y + r * (ch + gap), width: cw, height: box.height * scale };
      slots.push({ rect, box, scale });
    });
  } else {
    // 見出しと図を詰めて積み、全体を枠の中央に置く
    const n = cells.length;
    const gap = 40;
    const headH = t.font.lane.size * 2.4;
    const boxes = cells.map(boundsOf);
    const vertical = composition.direction === 'vertical';
    const sumH = boxes.reduce((a, b) => a + b.height, 0);
    const maxW = Math.max(...boxes.map((b) => b.width));
    const scale = vertical
      ? Math.min(body.width / maxW, (body.height - n * headH - gap * (n - 1)) / sumH, 1.1)
      : Math.min((body.width - gap * (n - 1)) / boxes.reduce((a, b) => a + b.width, 0), (body.height - headH) / Math.max(...boxes.map((b) => b.height)), 1.1);
    if (vertical) {
      const total = sumH * scale + n * headH + gap * (n - 1);
      let y = body.y + Math.min(120, Math.max(0, (body.height - total) / 2));
      boxes.forEach((box, i) => {
        slots.push({ rect: { x: body.x, y, width: body.width, height: headH + box.height * scale }, heading: composition.items[i].heading, scale, box });
        y += headH + box.height * scale + gap;
      });
    } else {
      let x = body.x;
      boxes.forEach((box, i) => {
        slots.push({ rect: { x, y: body.y, width: box.width * scale, height: body.height }, heading: composition.items[i].heading, scale, box });
        x += box.width * scale + gap;
      });
    }
  }

  const sources = composition.kind === 'grid' ? composition.sources ?? [] : cells.flatMap((c) => c.diagram.sources);

  return (
    <svg
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={width ?? size.width}
      height={height ?? size.height}
      role={open ? 'group' : 'img'}
      aria-label={composition.title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <defs>{skin.Defs(ctx)}</defs>
      {skin.Background(ctx, size)}
      {skin.Title(ctx, { x: margin, y: 36, width: size.width - margin * 2, height: titleH }, composition.title)}
      {cells.map((cell, i) => {
        const slot = slots[i];
        const headH = slot.heading ? t.font.lane.size * 2.4 : 0;
        const inner: Rect = { x: slot.rect.x, y: slot.rect.y + headH, width: slot.rect.width, height: slot.rect.height - headH };
        const s = slot.scale;
        const box = slot.box;
        const tx = inner.x + (inner.width - box.width * s) / 2 - box.x * s;
        const ty = inner.y + (inner.height - box.height * s) / 2 - box.y * s;
        drawn[i] = { x: tx + box.x * s, y: ty + box.y * s, width: box.width * s, height: box.height * s };
        return (
          <g key={cell.diagram.id}>
            {slot.heading && Text({ x: slot.rect.x, y: slot.rect.y, lines: [slot.heading], font: t.font.lane, fill: t.ink })}
            <g transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)})`}>
              <DiagramSvg
                diagram={cell.diagram}
                layout={cell.layout}
                frame={cellFrame(cell, time, mode)}
                steps={cell.timeline.steps}
                skin={skin}
                measure={measure}
                showTitle={composition.kind === 'grid'}
                showBackground={false}
                showCitation={false}
                debug={debug}
                width={cell.layout.size.width}
                height={cell.layout.size.height}
              />
            </g>
          </g>
        );
      })}
      {skin.Citation(ctx, { x: margin, y: size.height - citeH - 8, width: size.width - margin * 2, height: citeH }, dedupeSources(sources))}
      {open && (
        <g data-layer="open">
          {cells.map((cell, i) => {
            const it = open.items.find((x) => x.id === cell.diagram.id);
            if (!it) return null;
            const r = slots[i].heading ? slots[i].rect : drawn[i];
            const pad = 6;
            return <OpenHit key={it.id} ctx={ctx} rect={{ x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 }} radius={8} id={it.id} label={it.label} onOpen={open.onOpen} />;
          })}
        </g>
      )}
    </svg>
  );
}

export interface CompositionViewProps {
  composition: Composition;
  skin: Skin;
  model: CompositionModel;
  frame?: FrameAspect;
  debug?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
  open?: OpenHandlers;
}

/** Transport の状態を読んで renderComposition に渡すだけの薄い部品。 */
export function CompositionView({ composition, skin, model, frame = 'free', debug, width, height, className, open }: CompositionViewProps): ReactNode {
  const state = useTransport(model.transport);
  return renderComposition({
    composition,
    skin,
    cells: model.cells,
    t: state.t,
    mode: state.mode === 'static' ? 'static' : 'animated',
    frame,
    measure: model.measure,
    debug,
    width,
    height,
    className,
    open,
  });
}

function dedupeSources<T extends { title: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)));
}
