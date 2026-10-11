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

export const skinList: Skin[] = [sketchSkin, blueprintSkin, editorialSkin, neonSkin, plainSkin];

export function getSkin(id: string | null | undefined): Skin {
  return (id && skins[id as SkinId]) || sketchSkin;
}

export type { Skin, SkinId } from './types';
