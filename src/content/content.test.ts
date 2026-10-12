import { describe, it, expect } from 'vitest';
import { content } from './index';
import { diagramsOf } from '../model/diagram';
import { validateDiagram } from '../model/validate';
import { resolveLayout, tableMeasurer } from '../layout';
import { layoutStyleOf } from '../skins/types';
import { sketchSkin } from '../skins/sketch/skin';
import { plainSkin } from '../skins/plain/skin';
import { compileTimeline } from '../timeline';
import { fitScale } from '../render/fit';
import type { CompiledStep } from '../timeline/types';
import type { Pt, ResolvedLayout } from '../layout/types';

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 番号の丸が自分以外の線に乗っている所と、別の番号に接している所 */
function crowdedBadges(steps: CompiledStep[], layout: ResolvedLayout): string[] {
  const out: string[] = [];
  steps.forEach((s, i) => {
    for (const g of layout.edges.values()) {
      if (g.id === s.edges[0]) continue;
      const near = g.points.some((p, k) => k > 0 && segDist(s.badge, g.points[k - 1], p) < 13);
      if (near && !s.edges.includes(g.id)) out.push(`${s.n} が ${g.id} に乗る`);
    }
    for (const t of steps.slice(i + 1)) {
      if (t.n !== s.n && Math.hypot(s.badge.x - t.badge.x, s.badge.y - t.badge.y) < 30) out.push(`${s.n} と ${t.n} が接する`);
    }
  });
  return out;
}

describe('content', () => {
  it('RAG の各図には出典がある', () => {
    for (const entry of content.filter((c) => c.group.startsWith('RAG'))) {
      const ds = diagramsOf(entry.composition);
      expect(ds.some((d) => d.sources.length > 0), entry.composition.id).toBe(true);
    }
  });

  // 箱を描く様式（教科書）と、丸を描く既定の様式（略図）の両方で見る
  for (const entry of content) {
    for (const d of diagramsOf(entry.composition)) {
      it(`${d.id}: 定義に問題が無く、レイアウト警告が無く、タイムラインが組める`, () => {
        expect(validateDiagram(d)).toEqual([]);
        for (const skin of [sketchSkin, plainSkin]) {
          const layout = resolveLayout(d, layoutStyleOf(skin, tableMeasurer()), '4:5');
          expect(layout.warnings.filter((w) => w.kind !== 'figure-overflow'), skin.id).toEqual([]);
          expect(fitScale(layout), skin.id).toBeGreaterThanOrEqual(0.7);
          const tl = compileTimeline(d, layout);
          expect(tl.duration).toBeGreaterThan(0);
          expect(tl.steps.length).toBe(d.steps.length);
          expect(crowdedBadges(tl.steps, layout), skin.id).toEqual([]);
        }
      });
    }
  }
});
