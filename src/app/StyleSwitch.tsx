import { useRef, type KeyboardEvent } from 'react';
import { skinList, type SkinId } from '../skins';
import { S } from './strings';
import { rovingTarget } from './roving';

export interface StyleSwitchProps {
  value: SkinId;
  onChange: (id: SkinId) => void;
}

export function StyleSwitch({ value, onChange }: StyleSwitchProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, skinList.findIndex((s) => s.id === value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = rovingTarget(e, index, skinList.length, 'horizontal');
    if (to == null) return;
    e.preventDefault();
    onChange(skinList[to].id);
    refs.current[to]?.focus();
  };

  return (
    <div className="style-switch" role="tablist" aria-label={S.nav.style} onKeyDown={onKeyDown}>
      {skinList.map((s, i) => {
        const selected = s.id === value;
        return (
          <button
            key={s.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            className="style-switch__tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(s.id)}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
