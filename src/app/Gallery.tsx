import { useRef, type KeyboardEvent } from 'react';
import { content, type ContentEntry } from '../content';
import { S } from './strings';
import { rovingTarget } from './roving';
import { useDialog } from './use-dialog';
import { CloseIcon } from './Icons';

export interface GalleryProps {
  value: string;
  onChange: (id: string) => void;
}

function titleOf(e: ContentEntry): string {
  const c = e.composition;
  return c.kind === 'single' ? c.diagram.title : c.title;
}

function grouped(): Array<{ group: string; entries: ContentEntry[] }> {
  const out: Array<{ group: string; entries: ContentEntry[] }> = [];
  for (const e of content) {
    const g = out.find((x) => x.group === e.group);
    if (g) g.entries.push(e);
    else out.push({ group: e.group, entries: [e] });
  }
  return out;
}

const GROUPS = grouped();
const FLAT = content.map((e) => e.composition.id);

export function Gallery({ value, onChange }: GalleryProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const index = Math.max(0, FLAT.indexOf(value));

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const to = rovingTarget(e, index, FLAT.length, 'vertical');
    if (to == null) return;
    e.preventDefault();
    const id = FLAT[to];
    onChange(id);
    refs.current.get(id)?.focus();
  };

  return (
    <nav aria-label={S.gallery.title} onKeyDown={onKeyDown}>
      {GROUPS.map((g) => {
        const headingId = `gallery-group-${g.group}`;
        return (
          <section key={g.group} className="gallery__group">
            <h2 id={headingId} className="gallery__heading">
              {g.group}
            </h2>
            <div className="gallery__list" role="tablist" aria-orientation="vertical" aria-labelledby={headingId}>
              {g.entries.map((e) => {
                const id = e.composition.id;
                const selected = id === value;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      if (el) refs.current.set(id, el);
                      else refs.current.delete(id);
                    }}
                    type="button"
                    role="tab"
                    id={`gallery-tab-${id}`}
                    className="gallery__tab"
                    aria-selected={selected}
                    aria-controls="stage"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onChange(id)}
                  >
                    <span className="gallery__mark" aria-hidden="true">
                      {selected ? '▶' : ''}
                    </span>
                    <span className="gallery__title">{titleOf(e)}</span>
                    <span className="gallery__kind">{e.layer ? S.kinds.layer : S.kinds[e.composition.kind]}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

export interface GalleryDrawerProps extends GalleryProps {
  open: boolean;
  onClose: () => void;
}

/** 幅が狭いときの引き出し。中身は同じ Gallery。 */
export function GalleryDrawer({ open, onClose, value, onChange }: GalleryDrawerProps) {
  const ref = useDialog(open, onClose);
  return (
    <dialog ref={ref} className="dlg drawer" aria-labelledby="drawer-title">
      <div className="dlg__head">
        <h2 id="drawer-title" className="dlg__title">
          {S.gallery.title}
        </h2>
        <button type="button" className="ui-btn ui-btn--icon" aria-label={S.gallery.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="dlg__body">
        <Gallery value={value} onChange={onChange} />
      </div>
    </dialog>
  );
}
