/**
 * パーティクルエンジンの純粋計算関数
 * NodeDash の buildSegments / posAt を TypeScript 化
 */

export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  len: number;
  cumLen: number;
}

export interface Route {
  segs: Segment[];
  totalLen: number;
}

/**
 * ウェイポイント配列から直線セグメントを構築
 * 各セグメントに累積距離を持たせる
 */
export function buildSegments(waypoints: { x: number; y: number }[]): Route {
  if (waypoints.length < 2) {
    return { segs: [], totalLen: 0 };
  }

  const segs: Segment[] = [];
  let cumLen = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[i];
    const p1 = waypoints[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    cumLen += len;
    segs.push({
      x0: p0.x, y0: p0.y,
      x1: p1.x, y1: p1.y,
      len,
      cumLen,
    });
  }

  return { segs, totalLen: cumLen };
}

/**
 * ルート上の進捗率 t (0〜1) に対応する座標を返す
 * t=0 → 始点、t=1 → 終点
 */
export function posAt(route: Route, t: number): { x: number; y: number } {
  if (route.segs.length === 0) return { x: 0, y: 0 };
  if (t <= 0) return { x: route.segs[0].x0, y: route.segs[0].y0 };

  const target = t * route.totalLen;

  for (const seg of route.segs) {
    if (target <= seg.cumLen) {
      const segStart = seg.cumLen - seg.len;
      const ratio = seg.len > 0 ? (target - segStart) / seg.len : 0;
      return {
        x: seg.x0 + (seg.x1 - seg.x0) * ratio,
        y: seg.y0 + (seg.y1 - seg.y0) * ratio,
      };
    }
  }

  // t >= 1: 終点
  const last = route.segs[route.segs.length - 1];
  return { x: last.x1, y: last.y1 };
}
