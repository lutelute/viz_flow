import { useEffect, useRef } from 'react';
import type { Composition } from '../model/diagram';
import type { Skin } from '../skins';
import { DiagramPlayer, type PlayerModel } from '../render/DiagramPlayer';
import { CompositionView, compositionSize, type CompositionModel } from '../render/CompositionView';
import type { OpenHandlers } from '../render/OpenLayer';
import type { FrameAspect } from '../layout/types';
import { S } from './strings';
import { fitBox, useElementSize } from './use-size';
import { PlayIcon } from './Icons';
import type { Openable, OpenLevel } from './open-path';
import { useZoom } from './use-zoom';

export interface StageProps {
  view: Composition;
  levels: OpenLevel[];
  path: readonly string[];
  skin: Skin;
  player: PlayerModel;
  multi: CompositionModel;
  openables: Openable[];
  onOpen: (segment: string) => void;
  /** パンくずで上の段へ。depth は 0 始まり */
  onUp: (depth: number) => void;
  postFrame: boolean;
  onPostFrame: (on: boolean) => void;
  debug: boolean;
  /** OS が動きを減らす設定で、まだ再生していないとき */
  reducedNote: boolean;
  reduced: boolean;
  onPlay: () => void;
  /** 幅が狭いとき。高さではなく幅に合わせる */
  fitWidth?: boolean;
}

const MAX_SCALE = 1.5;

export function Stage(props: StageProps) {
  const { view, levels, path, skin, player, multi, openables, onOpen, onUp, postFrame, onPostFrame, debug, reducedNote, reduced, onPlay, fitWidth } = props;
  const viewRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const area = useElementSize(viewRef);
  const isSingle = view.kind === 'single';
  const frame: FrameAspect = postFrame ? '4:5' : 'free';
  const size = isSingle ? player.layout.size : compositionSize(view, frame, multi.cells);
  const box = fitWidth
    ? { width: Math.floor(area.width), height: Math.floor((area.width * size.height) / size.width) }
    : fitBox(size, area, MAX_SCALE);
  const fontStatus = isSingle ? player.fontStatus : multi.fontStatus;
  const fontNote = fontStatus === 'loading' ? S.fonts.loading : fontStatus === 'fallback' ? S.fonts.fallback : '';
  const depth = levels.length - 1;
  const viewKey = `${view.id}|${path.join('/')}`;
  useZoom(figRef, viewKey, path, reduced, box.width > 0);

  // 段が替わったら、押した部品は消えているので、フォーカスを図の領域に移す（読み上げは新しい段の名前）
  const firstKey = useRef(viewKey);
  useEffect(() => {
    if (firstKey.current === viewKey) return;
    firstKey.current = '';
    mainRef.current?.focus({ preventScroll: true });
  }, [viewKey]);

  const open: OpenHandlers | undefined =
    openables.length > 0
      ? {
          items: openables.map((o) => ({ id: o.segment, label: o.label })),
          onOpen: (id) => onOpen(id),
        }
      : undefined;

  return (
    <main ref={mainRef} id="stage" className="stage" role="tabpanel" tabIndex={-1} aria-label={levels[levels.length - 1].title}>
      <div className="stage__bar">
        {depth > 0 && (
          <nav className="crumbs" aria-label={S.open.crumbs}>
            <ol className="crumbs__list">
              {levels.map((lv, i) => (
                <li key={i} className="crumbs__item">
                  {i < depth ? (
                    <button type="button" className="crumbs__link" onClick={() => onUp(i)}>
                      {lv.title}
                    </button>
                  ) : (
                    <span className="crumbs__here" aria-current="page">
                      {lv.title}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <button type="button" className="ui-btn" onClick={() => onUp(depth - 1)} aria-keyshortcuts="Escape">
              {S.open.up}
            </button>
          </nav>
        )}
        <label className="ui-check" title={S.stage.postFrameHint}>
          <input type="checkbox" checked={postFrame} onChange={(e) => onPostFrame(e.target.checked)} />
          {S.stage.postFrame}
        </label>
        <div className="stage__notes">
          {openables.length > 0 && depth === 0 && <span className="ui-note">{isSingle ? S.open.hintParts : S.open.hintCells}</span>}
          {fontNote && (
            <span className="ui-status" role="status">
              {fontNote}
            </span>
          )}
          {reducedNote && (
            <>
              <span className="ui-status">{S.reducedMotion}</span>
              <button type="button" className="ui-btn" onClick={onPlay}>
                <PlayIcon />
                {S.stage.playNow}
              </button>
            </>
          )}
        </div>
      </div>
      <div ref={viewRef} className="stage__view">
        {box.width > 0 && (
          <div ref={figRef} className={postFrame ? 'stage__figure stage__figure--post' : 'stage__figure'} style={{ width: box.width, height: box.height }}>
            {view.kind === 'single' ? (
              <DiagramPlayer diagram={view.diagram} skin={skin} model={player} debug={debug} showCaption={postFrame} open={open} width="100%" height="100%" />
            ) : (
              <CompositionView composition={view} skin={skin} model={multi} frame={frame} debug={debug} open={open} width="100%" height="100%" />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
