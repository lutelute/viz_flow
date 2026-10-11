import { useEffect, useState, type ReactNode } from 'react';
import { findComposition } from '../content';
import { diagramsOf } from '../model/diagram';
import type { FrameAspect } from '../layout/types';
import { getSkin } from '../skins';
import { DiagramPlayer, usePlayerModel } from '../render/DiagramPlayer';
import { useTransport } from '../render/useTransport';
import { usePrefersReducedMotion } from '../core/a11y';
import { S } from './strings';

// M1〜M2 の作業用シェル。本番のシェル（ギャラリー・パネル・書き出し）は M4 で置き換える。

export function App(): ReactNode {
  const params = new URLSearchParams(window.location.search);
  const composition = findComposition(params.get('t'));
  const skin = getSkin(params.get('style'));
  const frame = (params.get('size') ?? 'free') as FrameAspect;
  const debug = params.get('debug') === '1';
  const reduced = usePrefersReducedMotion();
  const diagram = diagramsOf(composition)[0];
  const autoplay = !reduced && params.get('static') !== '1';

  const model = usePlayerModel(diagram, skin, frame, autoplay);
  const state = useTransport(model.transport);
  const at = params.get('at');
  useEffect(() => {
    if (at != null) model.transport.seek(Number(at));
  }, [at, model.transport]);
  const [showCaption, setShowCaption] = useState(frame !== 'free');
  const t = model.transport;
  const steps = model.timeline.steps;
  const stepIdx = Math.max(0, steps.findIndex((s) => state.t >= s.t0 && state.t < s.t1));

  return (
    <div style={{ minHeight: '100vh', background: skin.tokens.bg, color: skin.tokens.ink, fontFamily: `"${skin.tokens.font.caption.family}"`, padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 15 }}>
        <strong>{S.appTitle}</strong>
        <span>{diagram.title}</span>
        <span>様式: {skin.name}</span>
        <span>{model.fontStatus === 'ready' ? '' : model.fontStatus === 'loading' ? S.fonts.loading : S.fonts.fallback}</span>
        <a href={S.legacy.link} style={{ marginLeft: 'auto', color: skin.tokens.inkSoft }}>{S.legacy.note}</a>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 720px', maxWidth: 1080 }}>
          <DiagramPlayer diagram={diagram} skin={skin} model={model} debug={debug} showCaption={showCaption} width="100%" height="auto" />
        </div>
        <aside style={{ flex: '1 1 260px', minWidth: 240, fontSize: 15, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>{S.panel.steps}</div>
          <ol style={{ margin: 0, paddingLeft: 24 }}>
            {steps.map((s) => (
              <li key={s.index} style={{ fontWeight: state.mode !== 'static' && s.index === stepIdx ? 700 : 400, marginBottom: 4 }}>
                <button
                  onClick={() => t.seekStep(s.index)}
                  style={{ all: 'unset', display: 'block', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
                >
                  {s.caption}
                </button>
              </li>
            ))}
          </ol>
          {state.mode === 'static' && <p style={{ color: skin.tokens.inkSoft }}>{S.panel.static}</p>}
          {reduced && <p style={{ color: skin.tokens.inkSoft }}>{S.reducedMotion}</p>}
        </aside>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, fontSize: 15 }}>
        <button onClick={() => (state.mode === 'play' ? t.pause() : t.play())}>{state.mode === 'play' ? S.transport.pause : S.transport.play}</button>
        <button onClick={() => t.prev()}>{S.transport.prev}</button>
        <button onClick={() => t.next()}>{S.transport.next}</button>
        <label>
          {S.transport.seek}
          <input
            type="range"
            min={0}
            max={model.timeline.duration}
            step={1 / 30}
            value={state.t}
            onChange={(e) => t.seek(Number(e.target.value))}
            style={{ width: 260, verticalAlign: 'middle', marginLeft: 6 }}
          />
        </label>
        <span>{state.t.toFixed(1)} / {model.timeline.duration.toFixed(1)} 秒</span>
        <label>
          {S.transport.rate}
          <select value={state.rate} onChange={(e) => t.setRate(Number(e.target.value))} style={{ marginLeft: 6 }}>
            {[0.5, 0.75, 1, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={showCaption} onChange={(e) => setShowCaption(e.target.checked)} /> キャプション帯
        </label>
        <span style={{ color: skin.tokens.inkSoft }}>警告 {model.layout.warnings.length} 件</span>
      </div>
    </div>
  );
}
