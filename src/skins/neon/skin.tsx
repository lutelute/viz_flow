import { sketchSkin } from '../sketch/skin';
import type { Skin } from '../types';

// 仮の中身。ネオン様式はこれを置き換える。
export const neonSkin: Skin = { ...sketchSkin, id: 'neon', name: 'ネオン' };
