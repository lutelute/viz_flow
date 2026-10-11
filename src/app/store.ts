// シェルの状態を 1 か所に置く。再生位置や速度は Transport が持つので、ここには持たない。
import { useSyncExternalStore } from 'react';
import type { SkinId } from '../skins';
import { readUrl, type ThemeChoice } from './url-state';

/** URL から来た一度きりの指示。適用したら null に戻す。 */
export interface PendingSeek {
  step?: number;
  at?: number;
  static?: boolean;
}

export interface ShellState {
  templateId: string;
  styleId: SkinId;
  /** null は様式の既定（tokens.dark）に従う */
  theme: ThemeChoice;
  postFrame: boolean;
  debug: boolean;
  pending: PendingSeek | null;
  /** 「ひらく」で入った道のり。テンプレートを変えると空に戻す */
  openPath: string[];
}

type Listener = () => void;

export interface ShellStore {
  get(): ShellState;
  set(patch: Partial<ShellState>): void;
  subscribe(cb: Listener): () => void;
}

export function createShellStore(initial: ShellState): ShellStore {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch };
      let changed = false;
      for (const k of Object.keys(patch) as Array<keyof ShellState>) {
        if (next[k] !== state[k]) changed = true;
      }
      if (!changed) return;
      state = next;
      for (const cb of listeners) cb();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

export function pendingOf(u: { step: number | null; at: number | null; static: boolean }): PendingSeek | null {
  if (u.step == null && u.at == null && !u.static) return null;
  const p: PendingSeek = {};
  if (u.step != null) p.step = u.step;
  if (u.at != null) p.at = u.at;
  if (u.static) p.static = true;
  return p;
}

export function stateFromUrl(search: string): ShellState {
  const u = readUrl(search);
  return {
    templateId: u.t,
    styleId: u.style,
    theme: u.theme,
    postFrame: false,
    debug: u.debug,
    pending: pendingOf(u),
    openPath: u.open,
  };
}

export const shellStore: ShellStore = createShellStore(
  stateFromUrl(typeof window === 'undefined' ? '' : window.location.search),
);

export function useShell(store: ShellStore = shellStore): ShellState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
