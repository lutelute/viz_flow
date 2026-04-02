/**
 * JS パーティクルエンジン
 *
 * requestAnimationFrame ループで毎フレーム座標計算 → SVG innerHTML 一括書き込み
 * React の仮想 DOM を経由しない高速描画
 */
import { useEffect, useRef, useMemo } from 'react';
import type { ParticleGroup, GroupParticleBall, FlowNode, Waypoint } from '../core/types';
import type { Theme } from '../core/themes';
import { buildSegments, posAt } from '../core/particle-math';
import type { Route } from '../core/particle-math';
import { getIconPath } from '../utils/icons';

interface Props {
  groups: ParticleGroup[];
  nodeMap: Map<string, FlowNode>;
  layerRef: React.RefObject<SVGGElement | null>;
  theme: Theme;
  speed: number;
  /** 全球到着時のコールバック */
  onAllArrived?: () => void;
}

/** コンパイル済みの球データ */
interface CompiledBall {
  route: Route;
  color: string;
  label?: string;
  icon?: string;
  delay: number;
  travel: number;
  outerRadius: number;
  coreRadius: number;
  opacity: number;
}

/** コンパイル済みグループ */
interface CompiledGroup {
  balls: CompiledBall[];
  cycle: number;
  pauseDuration: number;
}

/** ウェイポイントのノードID → 座標解決 */
function resolveWaypoint(wp: Waypoint, nodeMap: Map<string, FlowNode>): { x: number; y: number } {
  if (typeof wp === 'string') {
    const node = nodeMap.get(wp);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  }
  return wp;
}

/** 2点間でL字経路の中間点を生成（computePathと同じルーティング） */
function routeSegment(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // ほぼ直線 — 中間点不要
  if (Math.abs(dx) < 8 || Math.abs(dy) < 8) {
    return [from, to];
  }

  // L字経路: computePathと同じロジック
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = from.x + dx * 0.5;
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  } else {
    const midY = from.y + dy * 0.5;
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  }
}

/** グループ定義 → コンパイル済みデータに変換 */
function compileGroups(
  groups: ParticleGroup[],
  nodeMap: Map<string, FlowNode>,
  speed: number,
): CompiledGroup[] {
  return groups.map(g => {
    const balls: CompiledBall[] = g.balls.map(b => {
      const resolved = b.waypoints.map(wp => resolveWaypoint(wp, nodeMap));
      // L字経路の中間点を挿入してエッジと同じルートを辿る
      const routed: { x: number; y: number }[] = [];
      for (let i = 0; i < resolved.length; i++) {
        if (i === 0) {
          routed.push(resolved[0]);
        } else {
          const seg = routeSegment(resolved[i - 1], resolved[i]);
          routed.push(...seg.slice(1));
        }
      }
      const route = buildSegments(routed);
      // travel: 指定がなければ距離ベースで自動計算 (150px/秒 × speed)
      const travel = b.travel ?? (route.totalLen / (150 * speed));

      return {
        route,
        color: b.color,
        label: b.label,
        icon: b.icon,
        delay: b.delay ?? 0,
        travel: Math.max(travel, 0.1),
        outerRadius: b.outerRadius ?? 12,
        coreRadius: b.coreRadius ?? 5,
        opacity: b.opacity ?? 1,
      };
    });

    const maxEnd = balls.length > 0
      ? Math.max(...balls.map(b => b.delay + b.travel))
      : 0;
    const pauseDuration = g.pauseDuration ?? 3;
    const cycle = maxEnd + pauseDuration;

    return { balls, cycle, pauseDuration };
  });
}

/** 1つの球のSVG文字列を生成 — グローなし、コアのみ */
function renderBall(b: CompiledBall, pos: { x: number; y: number }): string {
  const { x, y } = pos;
  let svg = '';

  // コアのみ（外殻グロー・パルス除去）
  svg += `<circle cx="${x}" cy="${y}" r="${b.coreRadius}" fill="${b.color}" opacity="${b.opacity}"/>`;

  // ラベル
  if (b.label) {
    svg += `<text x="${x}" y="${y + b.coreRadius + 14}" text-anchor="middle" fill="${b.color}" font-size="9" font-weight="600" font-family="'Inter',system-ui,sans-serif">${b.label}</text>`;
  }

  // アイコン (コア内に小さく)
  if (b.icon) {
    const iSz = b.coreRadius * 0.9;
    svg += `<svg x="${x - iSz}" y="${y - iSz}" width="${iSz * 2}" height="${iSz * 2}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">`;
    svg += `<path d="${getIconPath(b.icon)}"/>`;
    svg += `</svg>`;
  }

  return svg;
}

export function ParticleEngine({ groups, nodeMap, layerRef, theme, speed, onAllArrived }: Props) {
  const compiledRef = useRef<CompiledGroup[]>([]);
  const arrivedFiredRef = useRef<Set<number>>(new Set());

  const compiled = useMemo(
    () => compileGroups(groups, nodeMap, speed),
    [groups, nodeMap, speed],
  );

  useEffect(() => {
    compiledRef.current = compiled;
    arrivedFiredRef.current = new Set();
  }, [compiled]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let frameId: number;

    function render(time: number) {
      const t = time / 1000;
      let html = '';

      for (let gi = 0; gi < compiledRef.current.length; gi++) {
        const g = compiledRef.current[gi];
        if (g.cycle <= 0) continue;
        const cycleT = t % g.cycle;
        let allArrived = true;

        for (const b of g.balls) {
          const ballT = cycleT - b.delay;

          if (ballT < 0) {
            // 発射前: 描画しない
            allArrived = false;
            continue;
          }

          const progress = Math.min(ballT / b.travel, 1);
          const pos = posAt(b.route, progress);
          const arrived = progress >= 1;

          if (!arrived) allArrived = false;

          html += renderBall(b, pos);
        }

        // 全球到着コールバック
        if (allArrived && !arrivedFiredRef.current.has(gi)) {
          arrivedFiredRef.current.add(gi);
          onAllArrived?.();
        }

        // ポーズ期間が終わったらリセット
        const maxEnd = Math.max(...g.balls.map(b => b.delay + b.travel));
        if (cycleT < maxEnd * 0.5) {
          arrivedFiredRef.current.delete(gi);
        }
      }

      layer.innerHTML = html;
      frameId = requestAnimationFrame(render);
    }

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [layerRef, onAllArrived]);

  return null;
}
