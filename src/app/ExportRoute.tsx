import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { content, findComposition } from '../content';
import { diagramsOf, type Composition } from '../model/diagram';
import type { FrameAspect } from '../layout/types';
import { skinFor, skinList } from '../skins';
import type { Skin } from '../skins/types';
import { CompositionView, useCompositionModel, type CompositionModel } from '../render/CompositionView';
import { DiagramPlayer, usePlayerModel } from '../render/DiagramPlayer';

// ?export=1 用の素の描画。UI を描かず、投稿サイズの SVG を 1 枚だけ置く。
// Playwright がフレームごとに window.__vizflow.seek(t) を呼んで撮る。

export interface VizflowExportApi {
  isReady: boolean;
  duration: number;
  fps: number;
  width: number;
  height: number;
  steps: Array<{ n: number; t0: number; t1: number; caption: string }>;
  seek(t: number): void;
}

declare global {
  interface Window {
    __vizflow?: VizflowExportApi;
    __vizflowCatalog?: { templates: string[]; styles: string[] };
  }
}

const SIZES: Record<string, { aspect: FrameAspect; width: number; height: number }> = {
  '4x5': { aspect: '4:5', width: 1080, height: 1350 },
  '4:5': { aspect: '4:5', width: 1080, height: 1350 },
  '9x16': { aspect: '9:16', width: 1080, height: 1920 },
  '9:16': { aspect: '9:16', width: 1080, height: 1920 },
  '1x1': { aspect: '1:1', width: 1080, height: 1080 },
  '1:1': { aspect: '1:1', width: 1080, height: 1080 },
};

export function ExportRoute(): ReactNode {
  const params = new URLSearchParams(window.location.search);
  const composition = findComposition(params.get('t'));
  const skin = skinFor(params.get('style'), params.get('theme') === 'dark');
  const size = SIZES[params.get('size') ?? '4x5'] ?? SIZES['4x5'];
  const transparent = params.get('bg') === 'none';
  if (params.get('harness') === '1') void import('../export/devHarness').then((m) => m.installExportHarness());

  const model = useCompositionModel(composition, skin, false);
  const [painted, setPainted] = useState(false);

  const at = params.get('at');
  useEffect(() => {
    if (at != null) model.transport.seek(Number(at));
  }, [at, model.transport]);

  useEffect(() => {
    if (model.fontStatus === 'loading') return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPainted(true)));
    return () => cancelAnimationFrame(id);
  }, [model.fontStatus, model.cells]);

  const api = useMemo<VizflowExportApi>(
    () => ({
      isReady: false,
      duration: model.duration,
      fps: 30,
      width: size.width,
      height: size.height,
      steps: model.transport.timeline.steps.map((s) => ({ n: s.n, t0: s.t0, t1: s.t1, caption: s.caption })),
      seek: (t: number) => model.transport.seek(t),
    }),
    [model.duration, model.transport, size.width, size.height],
  );

  useEffect(() => {
    window.__vizflow = { ...api, isReady: painted && model.fontStatus !== 'loading' };
    window.__vizflowCatalog = { templates: content.map((c) => c.composition.id), styles: skinList.map((s) => s.id) };
  }, [api, painted, model.fontStatus]);

  return (
    <div style={{ width: size.width, height: size.height, overflow: 'hidden', background: transparent ? 'transparent' : skin.tokens.bg }}>
      <style>{`html,body{margin:0;background:${transparent ? 'transparent' : skin.tokens.bg};}`}</style>
      {composition.kind === 'single' ? (
        <SinglePost composition={composition} skin={skin} model={model} aspect={size.aspect} width={size.width} height={size.height} />
      ) : (
        <CompositionView composition={composition} skin={skin} model={model} frame={size.aspect} width={size.width} height={size.height} />
      )}
    </div>
  );
}

/** 単体の図は投稿枠（題名・キャプション帯・出典つき）で描く。時計は composition 側の Transport に従う。 */
function SinglePost({ composition, skin, model, aspect, width, height }: { composition: Composition; skin: Skin; model: CompositionModel; aspect: FrameAspect; width: number; height: number }): ReactNode {
  const diagram = diagramsOf(composition)[0];
  const playerModel = usePlayerModel(diagram, skin, aspect, false);
  useEffect(() => {
    const follow = () => {
      const st = model.transport.getState();
      if (st.mode === 'static') playerModel.transport.pause();
      else playerModel.transport.seek(st.t);
    };
    follow();
    return model.transport.subscribe(follow);
  }, [model.transport, playerModel.transport]);
  return <DiagramPlayer diagram={diagram} skin={skin} model={playerModel} showCaption width={width} height={height} />;
}
