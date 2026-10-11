import { sketchSkin } from '../sketch/skin';
import type { Skin } from '../types';

// 仮の中身。製図様式はこれを置き換える。
export const blueprintSkin: Skin = { ...sketchSkin, id: 'blueprint', name: '製図' };
