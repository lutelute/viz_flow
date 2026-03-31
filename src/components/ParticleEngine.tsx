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

/** グループ定義 → コンパイル済みデータに変換 */
function compileGroups(
  groups: ParticleGroup[],
  nodeMap: Map<string, FlowNode>,
  speed: number,
): CompiledGroup[] {
  return groups.map(g => {
    const balls: CompiledBall[] = g.balls.map(b => {
      const resolved = b.waypoints.map(wp => resolveWaypoint(wp, nodeMap));
      const route = buildSegments(resolved);
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

/** 1つの球のSVG文字列を生成 */
function renderBall(b: CompiledBall, pos: { x: number; y: number }, arrived: boolean): string {
  const { x, y } = pos;
  let svg = '';

  // 外殻グロー
  svg += `<circle cx="${x}" cy="${y}" r="${b.outerRadius}" fill="${b.color}" opacity="${0.15 * b.opacity}" filter="url(#glow)"/>`;

  // コア
  svg += `<circle cx="${x}" cy="${y}" r="${b.coreRadius}" fill="${b.color}" opacity="${0.9 * b.opacity}"/>`;

  // 到着時のパルスリング
  if (arrived) {
    svg += `<circle cx="${x}" cy="${y}" r="${b.coreRadius}" fill="none" stroke="${b.color}" stroke-width="1.5" opacity="0.4">`;
    svg += `<animate attributeName="r" values="${b.coreRadius};${b.outerRadius * 2}" dur="0.6s" repeatCount="1"/>`;
    svg += `<animate attributeName="opacity" values="0.4;0" dur="0.6s" repeatCount="1"/>`;
    svg += `</circle>`;
  }

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

          html += renderBall(b, pos, false);
        }

        // 全球到着 → パルス(1回だけ)
        if (allArrived && !arrivedFiredRef.current.has(gi)) {
          arrivedFiredRef.current.add(gi);
          // 最後の球の終点にパルス
          const lastBall = g.balls[g.balls.length - 1];
          if (lastBall) {
            const endPos = posAt(lastBall.route, 1);
            html += `<circle cx="${endPos.x}" cy="${endPos.y}" r="6" fill="none" stroke="${lastBall.color}" stroke-width="2" opacity="0.6">`;
            html += `<animate attributeName="r" values="6;25" dur="0.8s" fill="freeze"/>`;
            html += `<animate attributeName="opacity" values="0.6;0" dur="0.8s" fill="freeze"/>`;
            html += `</circle>`;
          }
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
