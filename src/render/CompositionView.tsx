import { useMemo, type ReactNode } from 'react';
import type { Composition, Diagram } from '../model/diagram';
import { diagramsOf } from '../model/diagram';
import { assertValidDiagram } from '../model/validate';
import type { FrameAspect, Rect, TextMeasurer } from '../layout/types';
import { canvasMeasurer, resolveLayout } from '../layout';
import { compileTimeline, sampleAt, sampleStatic, Transport } from '../timeline';
import type { CompiledTimeline } from '../timeline/types';
import { layoutStyleOf, makeCtx, type Skin } from '../skins/types';
import { useSkinFonts } from '../skins/fonts';
import { Text } from '../skins/text';
import { DiagramSvg } from './DiagramSvg';
import { useTransport } from './useTransport';
import { figureBounds } from './fit';

// 複数の図を 1 枚にまとめる形態。grid（8 枚の一覧）と stack（上下の比較）。
// 時計は 1 つで、短い図は末尾で止まる（lockstep）。

interface Cell {
  diagram: Diagram;
  layout: ReturnType<typeof resolveLayout>;
  timeline: CompiledTimeline;
}

export interface CompositionModel {
  cells: Cell[];
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

export function useCompositionModel(composition: Composition, skin: Skin, autoplay: boolean): CompositionModel {
  const fontStatus = useSkinFonts(skin);
  const measure = useMemo(() => freshMeasurer(`${skin.id}:${fontStatus}`), [skin.id, fontStatus]);
  const cells = useMemo<Cell[]>(() => {
    return diagramsOf(composition).map((diagram) => {
      assertValidDiagram(diagram);
      const layout = resolveLayout(diagram, layoutStyleOf(skin, measure), 'free');
      return { diagram, layout, timeline: compileTimeline(diagram, layout) };
    });
  }, [composition, skin, measure]);
  const duration = Math.max(...cells.map((c) => c.timeline.duration));
  const transport = useMemo(() => {
    const longest = cells.reduce((a, b) => (a.timeline.duration >= b.timeline.duration ? a : b));
    const merged: CompiledTimeline = { ...longest.timeline, diagramId: composition.id, duration };
    return new Transport(merged, { mode: autoplay ? 'play' : 'static' });
  }, [cells, composition.id, duration, autoplay]);
  return { cells, transport, fontStatus, measure, duration };
}

const FRAME_SIZE: Record<Exclude<FrameAspect, 'free'>, { width: number; height: number }> = {
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export interface CompositionViewProps {
  composition: Composition;
  skin: Skin;
  model: CompositionModel;
  frame?: FrameAspect;
  debug?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function CompositionView({ composition, skin, model, frame = 'free', debug, width, height, className }: CompositionViewProps): ReactNode {
  const state = useTransport(model.transport);
  const t = skin.tokens;

  if (composition.kind === 'single') {
    const cell = model.cells[0];
    const fr = state.mode === 'static' ? sampleStatic(cell.timeline) : sampleAt(cell.timeline, state.t);
    return <DiagramSvg diagram={cell.diagram} layout={cell.layout} frame={fr} steps={cell.timeline.steps} skin={skin} measure={model.measure} debug={debug} width={width} height={height} className={className} />;
  }

  const size = frame === 'free' ? { width: 1080, height: composition.kind === 'grid' ? 1500 : 1400 } : FRAME_SIZE[frame];
  const margin = 40;
  const titleH = 120;
  const citeH = 56;
  const body: Rect = { x: margin, y: titleH, width: size.width - margin * 2, height: size.height - titleH - citeH - margin };
  const ctx = makeCtx(skin, composition.id, state.mode === 'static' ? 'static' : 'animated', model.measure);

  const slots: Array<{ rect: Rect; heading?: string; scale: number; box: Rect }> = [];
  const boundsOf = (cell: Cell): Rect => {
    const b = figureBounds(cell.layout);
    return b ?? { x: 0, y: 0, width: cell.layout.size.width, height: cell.layout.size.height };
  };
  if (composition.kind === 'grid') {
    const cols = composition.columns;
    const rows = Math.ceil(model.cells.length / cols);
    const gap = 24;
    const cw = (body.width - gap * (cols - 1)) / cols;
    const ch = (body.height - gap * (rows - 1)) / rows;
    model.cells.forEach((cell, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const box = { x: 0, y: 0, width: cell.layout.size.width, height: cell.layout.size.height };
      const rect = { x: body.x + c * (cw + gap), y: body.y + r * (ch + gap), width: cw, height: ch };
      slots.push({ rect, box, scale: Math.min(rect.width / box.width, rect.height / box.height) });
    });
  } else {
    // 見出しと図を詰めて積み、全体を枠の中央に置く
    const n = model.cells.length;
    const gap = 40;
    const headH = t.font.lane.size * 1.8;
    const boxes = model.cells.map(boundsOf);
    const vertical = composition.direction === 'vertical';
    const sumH = boxes.reduce((a, b) => a + b.height, 0);
    const maxW = Math.max(...boxes.map((b) => b.width));
    const scale = vertical
      ? Math.min(body.width / maxW, (body.height - n * headH - gap * (n - 1)) / sumH, 1.1)
      : Math.min((body.width - gap * (n - 1)) / boxes.reduce((a, b) => a + b.width, 0), (body.height - headH) / Math.max(...boxes.map((b) => b.height)), 1.1);
    if (vertical) {
      const total = sumH * scale + n * headH + gap * (n - 1);
      let y = body.y + Math.max(0, (body.height - total) / 2);
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

  const sources = composition.kind === 'grid' ? composition.sources ?? [] : model.cells.flatMap((c) => c.diagram.sources);

  return (
    <svg viewBox={`0 0 ${size.width} ${size.height}`} width={width ?? size.width} height={height ?? size.height} role="img" aria-label={composition.title} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>{skin.Defs(ctx)}</defs>
      {skin.Background(ctx, size)}
      {skin.Title(ctx, { x: margin, y: 36, width: size.width - margin * 2, height: titleH }, composition.title)}
      {model.cells.map((cell, i) => {
        const slot = slots[i];
        const headH = slot.heading ? t.font.lane.size * 1.8 : 0;
        const inner: Rect = { x: slot.rect.x, y: slot.rect.y + headH, width: slot.rect.width, height: slot.rect.height - headH };
        const s = slot.scale;
        const box = slot.box;
        const tx = inner.x + (inner.width - box.width * s) / 2 - box.x * s;
        const ty = inner.y + (inner.height - box.height * s) / 2 - box.y * s;
        const fr = state.mode === 'static' ? sampleStatic(cell.timeline) : sampleAt(cell.timeline, Math.min(state.t, cell.timeline.duration - 0.001));
        return (
          <g key={cell.diagram.id}>
            {slot.heading && Text({ x: slot.rect.x, y: slot.rect.y, lines: [slot.heading], font: t.font.lane, fill: t.ink })}
            <g transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)})`}>
              <DiagramSvg
                diagram={cell.diagram}
                layout={cell.layout}
                frame={fr}
                steps={cell.timeline.steps}
                skin={skin}
                measure={model.measure}
                showTitle={composition.kind === 'grid'}
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
    </svg>
  );
}

function dedupeSources<T extends { title: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)));
}
