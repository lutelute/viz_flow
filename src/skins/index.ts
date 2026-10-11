import type { Skin, SkinId } from './types';
import { sketchSkin } from './sketch/skin';
import { blueprintSkin } from './blueprint/skin';
import { editorialSkin } from './editorial/skin';
import { neonSkin } from './neon/skin';
import { plainSkin } from './plain/skin';

export const skins: Record<SkinId, Skin> = {
  sketch: sketchSkin,
  blueprint: blueprintSkin,
  editorial: editorialSkin,
  neon: neonSkin,
  plain: plainSkin,
};

// 並びの先頭が既定。いちばん軽い略図から見せる
export const skinList: Skin[] = [plainSkin, sketchSkin, blueprintSkin, editorialSkin, neonSkin];

export function getSkin(id: string | null | undefined): Skin {
  return (id && skins[id as SkinId]) || skinList[0];
}

export type { Skin, SkinId } from './types';
