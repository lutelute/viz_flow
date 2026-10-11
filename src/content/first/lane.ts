import type { Lane } from '../../model/diagram';

// 最初の版の図は帯も見出しも無い 1 本のレーンに置く。部品を少なく、線を短くするのが元の版の良さ。
export const flowLane: Lane[] = [{ id: 'flow', frame: 'none' }];
