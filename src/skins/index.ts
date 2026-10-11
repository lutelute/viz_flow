import type { Skin, SkinId } from './types';
import { sketchSkin } from './sketch/skin';

export const skins: Partial<Record<SkinId, Skin>> = {
  sketch: sketchSkin,
};

export const skinList: Skin[] = [sketchSkin];

export function getSkin(id: string | null | undefined): Skin {
  return (id && skins[id as SkinId]) || sketchSkin;
}

export type { Skin, SkinId } from './types';
