import { useEffect, useMemo, type ReactNode } from 'react';
import type { Diagram } from '../model/diagram';
import { assertValidDiagram } from '../model/validate';
import type { FrameAspect, TextMeasurer } from '../layout/types';
import { canvasMeasurer, resolveLayout } from '../layout';
import { compileTimeline, sampleAt, sampleStatic, Transport } from '../timeline';
import type { CompiledTimeline } from '../timeline/types';
import { layoutStyleOf, type Skin } from '../skins/types';
import { useSkinFonts } from '../skins/fonts';
import { DiagramSvg } from './DiagramSvg';
import { useTransport } from './useTransport';

/** フォントの読み込み前後で測定キャッシュを分けるため、キーごとに測定器を作り直す。 */
function freshMeasurer(key: string): TextMeasurer {
  void key;
  return canvasMeasurer();
}

export interface PlayerModel {
  timeline: CompiledTimeline;
  transport: Transport;
  layout: ReturnType<typeof resolveLayout>;
  fontStatus: ReturnType<typeof useSkinFonts>;
}

/**
 * 図 1 枚ぶんの「レイアウト → タイムライン → Transport」を組み立てる。
 * フォントが使えるようになったら測り直して組み直す。
 */
export function usePlayerModel(diagram: Diagram, skin: Skin, frame: FrameAspect, autoplay: boolean): PlayerModel {
  const fontStatus = useSkinFonts(skin);
  const measure: TextMeasurer = useMemo(() => freshMeasurer(`${skin.id}:${fontStatus}`), [skin.id, fontStatus]);

  const layout = useMemo(() => {
    assertValidDiagram(diagram);
    return resolveLayout(diagram, layoutStyleOf(skin, measure), frame);
  }, [diagram, skin, measure, frame]);

  const timeline = useMemo(() => compileTimeline(diagram, layout), [diagram, layout]);

  const transport = useMemo(() => new Transport(timeline, { mode: autoplay ? 'play' : 'static' }), [timeline, autoplay]);

  return { timeline, transport, layout, fontStatus };
}

export interface DiagramPlayerProps {
  diagram: Diagram;
  skin: Skin;
  model: PlayerModel;
  frame?: FrameAspect;
  debug?: boolean;
  showCaption?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function DiagramPlayer({ diagram, skin, model, debug, showCaption, width, height, className }: DiagramPlayerProps): ReactNode {
  const { timeline, transport, layout } = model;
  const state = useTransport(transport);
  const measure = useMemo(() => freshMeasurer(`${skin.id}:${model.fontStatus}`), [skin.id, model.fontStatus]);

  const labeledEdges = useMemo(() => new Set(diagram.edges.filter((e) => e.label).map((e) => e.id)), [diagram]);
  const frame = useMemo(
    () => (state.mode === 'static' ? sampleStatic(timeline, { labeledEdges }) : sampleAt(timeline, state.t)),
    [timeline, state.mode, state.t, labeledEdges],
  );

  useEffect(() => {
    if (import.meta.env.DEV && layout.warnings.length > 0) {
      console.warn(`[layout] ${diagram.id}`, layout.warnings);
    }
  }, [layout, diagram.id]);

  return (
    <DiagramSvg
      diagram={diagram}
      layout={layout}
      frame={frame}
      steps={timeline.steps}
      skin={skin}
      measure={measure}
      debug={debug}
      showCaption={showCaption}
      width={width}
      height={height}
      className={className}
    />
  );
}
