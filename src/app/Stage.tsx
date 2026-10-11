import { useRef } from 'react';
import type { Diagram } from '../model/diagram';
import type { Skin } from '../skins';
import { DiagramPlayer, type PlayerModel } from '../render/DiagramPlayer';
import { S } from './strings';
import { fitBox, useElementSize } from './use-size';
import { PlayIcon } from './Icons';

export interface StageProps {
  diagram: Diagram;
  skin: Skin;
  model: PlayerModel;
  postFrame: boolean;
  onPostFrame: (on: boolean) => void;
  debug: boolean;
  /** OS が動きを減らす設定で、まだ再生していないとき */
  reducedNote: boolean;
  onPlay: () => void;
  /** 幅が狭いとき。高さではなく幅に合わせる */
  fitWidth?: boolean;
}

const MAX_SCALE = 1.5;

export function Stage({ diagram, skin, model, postFrame, onPostFrame, debug, reducedNote, onPlay, fitWidth }: StageProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(viewRef);
  const view = model.layout.size;
  const box = fitWidth
    ? { width: Math.floor(area.width), height: Math.floor((area.width * view.height) / view.width) }
    : fitBox(view, area, MAX_SCALE);
  const fontNote = model.fontStatus === 'loading' ? S.fonts.loading : model.fontStatus === 'fallback' ? S.fonts.fallback : '';

  return (
    <main id="stage" className="stage" role="tabpanel" aria-label={diagram.title}>
      <div className="stage__bar">
        <label className="ui-check" title={S.stage.postFrameHint}>
          <input type="checkbox" checked={postFrame} onChange={(e) => onPostFrame(e.target.checked)} />
          {S.stage.postFrame}
        </label>
        <div className="stage__notes">
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
          <div className={postFrame ? 'stage__figure stage__figure--post' : 'stage__figure'} style={{ width: box.width, height: box.height }}>
            <DiagramPlayer diagram={diagram} skin={skin} model={model} debug={debug} showCaption={postFrame} width="100%" height="100%" />
          </div>
        )}
      </div>
    </main>
  );
}
