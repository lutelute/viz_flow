import rough from 'roughjs/bin/rough';
import type { Drawable, Options } from 'roughjs/bin/core';
import type { RoughGenerator } from 'roughjs/bin/generator';

export interface PathInfo {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
}

const generator: RoughGenerator = rough.generator();
const cache = new Map<string, PathInfo[]>();

export const ROUGH_BASE: Options = {
  roughness: 0.7,
  bowing: 0.6,
  strokeWidth: 2.2,
  fillStyle: 'solid',
  preserveVertices: true,
};

/**
 * 手描きパスをキーと seed でメモ化する。同じ入力なら同じパスが返り、毎フレームの再生成を防ぐ。
 * キーには寸法を含めること（例 `node:docs:120x56`）。
 */
export function roughShape(key: string, seed: number, build: (g: RoughGenerator, base: Options) => Drawable): PathInfo[] {
  const k = `${key}#${seed}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const drawable = build(generator, { ...ROUGH_BASE, seed });
  const paths = generator.toPaths(drawable).map((p) => ({
    d: p.d,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    fill: p.fill ?? 'none',
  }));
  cache.set(k, paths);
  return paths;
}

export function clearRoughCache(): void {
  cache.clear();
}
