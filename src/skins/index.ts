import type { Skin, SkinId } from './types';
import { sketchSkin } from './sketch/skin';
import { blueprintSkin } from './blueprint/skin';
import { editorialSkin } from './editorial/skin';
import { neonSkin } from './neon/skin';
import { plainDarkSkin, plainSkin } from './plain/skin';

export const skins: Record<SkinId, Skin> = {
  sketch: sketchSkin,
  blueprint: blueprintSkin,
  editorial: editorialSkin,
  neon: neonSkin,
  plain: plainSkin,
  'plain-dark': plainDarkSkin,
};

// 並びの先頭が既定。いちばん軽い略図から見せる。暗い版は様式の切替には出さない
export const skinList: Skin[] = [plainSkin, sketchSkin, blueprintSkin, editorialSkin, neonSkin];

/** 画面をダークにしたとき図も暗くできる様式と、その暗い版 */
const DARK_TWIN: Partial<Record<SkinId, Skin>> = { plain: plainDarkSkin };

export function getSkin(id: string | null | undefined): Skin {
  return (id && skins[id as SkinId]) || skinList[0];
}

/** 明暗の両方を持つ様式か。持つものは、明暗を選んでいなければ OS の設定に従わせる */
export function hasDarkTwin(id: string | null | undefined): boolean {
  return DARK_TWIN[getSkin(id).id] != null;
}

/** 選んだ様式を、画面の明暗に合わせて引く。暗い版の無い様式はそのまま返す */
export function skinFor(id: string | null | undefined, dark: boolean): Skin {
  const base = getSkin(id);
  return (dark && DARK_TWIN[base.id]) || base;
}

export type { Skin, SkinId } from './types';
