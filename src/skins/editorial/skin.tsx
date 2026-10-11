import { sketchSkin } from '../sketch/skin';
import type { Skin } from '../types';

// 仮の中身。誌面様式はこれを置き換える。
export const editorialSkin: Skin = { ...sketchSkin, id: 'editorial', name: '誌面' };
