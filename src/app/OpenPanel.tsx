import type { Openable } from './open-path';
import { S } from './strings';

export interface OpenPanelProps {
  items: Openable[];
  /** 一覧・比較の段では「1 枚をひらく」、単体の段では「部品をひらく」 */
  multi: boolean;
  onOpen: (segment: string) => void;
}

/** 図の中の印と同じものを、文字の一覧でも選べるようにする。キーボードと読み上げ向け。 */
export function OpenPanel({ items, multi, onOpen }: OpenPanelProps) {
  const detail = items.find((o) => o.detail);
  const parts = items.filter((o) => !o.detail);
  return (
    <>
      {detail && (
        <section aria-labelledby="panel-detail">
          <h2 id="panel-detail">{S.open.detailGo}</h2>
          <ul className="openlist">
            <li>
              <button type="button" className="openlist__btn" onClick={() => onOpen(detail.segment)}>
                <span className="openlist__mark" aria-hidden="true" />
                <span className="openlist__name">{detail.target.title}</span>
                {detail.target.subtitle && <span className="openlist__sub">{detail.target.subtitle}</span>}
              </button>
            </li>
          </ul>
        </section>
      )}
      {parts.length > 0 && (
        <PartList items={parts} multi={multi} onOpen={onOpen} />
      )}
    </>
  );
}

function PartList({ items, multi, onOpen }: OpenPanelProps) {
  return (
    <section aria-labelledby="panel-open">
      <h2 id="panel-open">{multi ? S.open.cellsHeading : S.open.partsHeading}</h2>
      <ul className="openlist">
        {items.map((o) => (
          <li key={o.segment}>
            <button type="button" className="openlist__btn" onClick={() => onOpen(o.segment)}>
              <span className="openlist__mark" aria-hidden="true" />
              <span className="openlist__name">{o.label}</span>
              {o.target.subtitle && <span className="openlist__sub">{o.target.subtitle}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
