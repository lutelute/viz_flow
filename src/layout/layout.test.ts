import { describe, it, expect } from 'vitest';
import type { Diagram } from '../model/diagram';
import type { LayoutStyle, Pt } from './types';
import { tableMeasurer } from './measure';
import { assignDepths, resolveLayout } from './grid';
import { roundedPathD, sampleCorners } from './route';
import { buildSegments } from '../core/particle-math';

const style: LayoutStyle = {
  grid: { colWidth: 220, rowHeight: 120, laneGap: 48, padding: 40, laneHeader: 36 },
  font: {
    label: { family: 'sans-serif', size: 15, weight: 600 },
    sublabel: { family: 'sans-serif', size: 12, weight: 400 },
    edge: { family: 'sans-serif', size: 12, weight: 500 },
  },
  nodeMin: { sm: { w: 96, h: 60 }, md: { w: 120, h: 72 }, lg: { w: 150, h: 90 } },
  nodePad: 12,
  iconSize: 28,
  corner: 8,
  stub: 12,
  track: 10,
  measure: tableMeasurer(),
};

/** 2 レーン × 4 列、8 ノード、7 エッジ、ループ 1 本 */
function sampleRag(): Diagram {
  return {
    id: 'sample-rag',
    title: '基本の RAG',
    lanes: [
      { id: 'index', label: '索引づくり' },
      { id: 'answer', label: '質問に答える' },
    ],
    nodes: [
      { id: 'docs', kind: 'documents', label: '文書群', lane: 'index', col: 0 },
      { id: 'chunk', kind: 'chunker', label: 'チャンク分割', lane: 'index', col: 1 },
      { id: 'embed', kind: 'embedding', label: '埋め込みモデル', lane: 'index', col: 2 },
      { id: 'vdb', kind: 'vectordb', label: 'ベクトル DB', lane: 'index', col: 3 },
      { id: 'query', kind: 'query', label: '質問', lane: 'answer', col: 0 },
      { id: 'search', kind: 'retriever', label: '類似検索', lane: 'answer', col: 1 },
      { id: 'prompt', kind: 'prompt', label: 'プロンプト\nテンプレート', lane: 'answer', col: 2 },
      { id: 'llm', kind: 'llm', label: 'LLM', lane: 'answer', col: 3 },
    ],
    edges: [
      { id: 'e1', from: 'docs', to: 'chunk', label: '分割' },
      { id: 'e2', from: 'chunk', to: 'embed' },
      { id: 'e3', from: 'embed', to: 'vdb', label: '保存' },
      { id: 'e4', from: 'query', to: 'search' },
      { id: 'e5', from: 'search', to: 'prompt', label: '上位 3 件' },
      { id: 'e6', from: 'prompt', to: 'llm' },
      { id: 'e7', from: 'vdb', to: 'search', label: '近いチャンク' },
      { id: 'loop', from: 'llm', to: 'search', role: 'loop', label: '再検索' },
    ],
    steps: [],
    sources: [],
  };
}

/** 1 つの分岐器から次の列の 3 行へ */
function fanOut(): Diagram {
  return {
    id: 'fan-out',
    title: '分岐',
    lanes: [{ id: 'a', label: '判定' }],
    nodes: [
      { id: 'router', kind: 'router', label: '分類器', lane: 'a', col: 0, row: 0 },
      { id: 'A', kind: 'generic', label: '検索なし', lane: 'a', col: 1, row: 1 },
      { id: 'B', kind: 'generic', label: '1 回検索', lane: 'a', col: 1, row: 2 },
      { id: 'C', kind: 'generic', label: '多段検索', lane: 'a', col: 1, row: 3 },
    ],
    edges: [
      { id: 'ra', from: 'router', to: 'A', role: 'branch', branch: { group: 'g', option: 'A' }, label: '単純' },
      { id: 'rb', from: 'router', to: 'B', role: 'branch', branch: { group: 'g', option: 'B' }, label: '普通' },
      { id: 'rc', from: 'router', to: 'C', role: 'branch', branch: { group: 'g', option: 'C' }, label: '複雑' },
    ],
    steps: [],
    sources: [],
  };
}

function inside(p: Pt, r: { x: number; y: number; width: number; height: number }, tol = 0.01): boolean {
  return p.x >= r.x - tol && p.x <= r.x + r.width + tol && p.y >= r.y - tol && p.y <= r.y + r.height + tol;
}

function quadAt(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** SVGPathElement が無いので、Q を 8 分割した折れ線で d の実長を近似する */
function pathLength(d: string): number {
  const tokens = d.trim().split(/\s+/);
  let i = 0;
  let cur: Pt = { x: 0, y: 0 };
  let len = 0;
  const read = (): Pt => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      cur = read();
    } else if (cmd === 'L') {
      const p = read();
      len += Math.hypot(p.x - cur.x, p.y - cur.y);
      cur = p;
    } else if (cmd === 'Q') {
      const c = read();
      const p = read();
      let prev = cur;
      for (let k = 1; k <= 8; k++) {
        const q = quadAt(cur, c, p, k / 8);
        len += Math.hypot(q.x - prev.x, q.y - prev.y);
        prev = q;
      }
      cur = p;
    } else {
      throw new Error(`unknown command ${cmd}`);
    }
  }
  return len;
}

describe('assignDepths', () => {
  it('最長路で列を付ける', () => {
    const d = assignDepths(['a', 'b', 'c', 'd'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
      { from: 'c', to: 'd' },
    ]);
    expect([...d.entries()]).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 3]]);
  });

  it('ループ辺を外してサイクルを解く', () => {
    const d = assignDepths(['a', 'b', 'c'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a', role: 'loop' },
    ]);
    expect(d.get('c')).toBe(2);
  });

  it('それでも残るサイクルは入力順で前向きの辺だけ使う', () => {
    const d = assignDepths(['a', 'b', 'c'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'b' },
    ]);
    expect([...d.values()]).toEqual([0, 1, 2]);
  });

  it('固定した列から後続を数える', () => {
    const d = assignDepths(['a', 'b'], [{ from: 'a', to: 'b' }], new Map([['a', 2]]));
    expect(d.get('b')).toBe(3);
  });
});

describe('resolveLayout: 2 レーンの RAG', () => {
  const layout = resolveLayout(sampleRag(), style, '4:5');

  it('警告が無い', () => {
    expect(layout.warnings).toEqual([]);
  });

  it('全ノードが figure の中にある', () => {
    for (const n of layout.nodes.values()) {
      expect(inside({ x: n.x, y: n.y }, layout.figure)).toBe(true);
      expect(inside({ x: n.x + n.w, y: n.y + n.h }, layout.figure)).toBe(true);
    }
    expect(layout.size).toEqual({ width: 1080, height: 1350 });
  });

  it('ポートは箱の辺の中点にある', () => {
    for (const n of layout.nodes.values()) {
      expect(n.ports.top).toEqual({ x: n.cx, y: n.y });
      expect(n.ports.bottom).toEqual({ x: n.cx, y: n.y + n.h });
      expect(n.ports.left).toEqual({ x: n.x, y: n.cy });
      expect(n.ports.right).toEqual({ x: n.x + n.w, y: n.cy });
    }
  });

  it('レーンは配列順に上から並ぶ', () => {
    const a = layout.lanes.get('index')!;
    const b = layout.lanes.get('answer')!;
    expect(a.y + a.height).toBeLessThan(b.y);
  });

  it('手動改行が labelLines に出る', () => {
    expect(layout.nodes.get('prompt')!.labelLines).toEqual(['プロンプト', 'テンプレート']);
  });

  it('ループは下側の外周チャネルを通る', () => {
    const lane = layout.lanes.get('answer')!;
    const loop = layout.edges.get('loop')!;
    const lowest = Math.max(...loop.points.map((p) => p.y));
    expect(lowest).toBeGreaterThan(lane.y + lane.height);
    expect(loop.points[0]).toEqual(layout.nodes.get('llm')!.ports.bottom);
    expect(loop.points[loop.points.length - 1]).toEqual(layout.nodes.get('search')!.ports.bottom);
  });

  it('後戻りの辺はレーンの隙間を通って相手の上から入る', () => {
    const e7 = layout.edges.get('e7')!;
    const a = layout.lanes.get('index')!;
    const b = layout.lanes.get('answer')!;
    const mid = e7.points[1].y;
    expect(mid).toBeGreaterThan(a.y + a.height);
    expect(mid).toBeLessThan(b.y);
    expect(e7.points[e7.points.length - 1]).toEqual(layout.nodes.get('search')!.ports.top);
  });

  it('矢印は終点を向く', () => {
    const e1 = layout.edges.get('e1')!;
    expect(e1.arrowAngle).toBeCloseTo(0);
    expect(e1.arrowAt).toEqual(layout.nodes.get('chunk')!.ports.left);
  });

  it('ラベルは線から離れ、バッジはその反対側にある', () => {
    const e1 = layout.edges.get('e1')!;
    const y = e1.points[0].y;
    expect(e1.label!.pos.y).toBeLessThan(y);
    expect(e1.badgeAt.y).toBeGreaterThan(y);
    expect(e1.label!.lines).toEqual(['分割']);
  });

  it('同じ入力なら同じ結果になる', () => {
    expect(resolveLayout(sampleRag(), style, '4:5')).toEqual(layout);
  });
});

describe('resolveLayout: ファンアウト', () => {
  const layout = resolveLayout(fanOut(), style, 'free');

  it('3 本が幹線を共有する', () => {
    const xs = ['ra', 'rb', 'rc'].map((id) => layout.edges.get(id)!.points[1].x);
    expect(xs[0]).toBe(xs[1]);
    expect(xs[1]).toBe(xs[2]);
    for (const id of ['ra', 'rb', 'rc']) expect(layout.edges.get(id)!.points.length).toBe(4);
  });

  it('枝は相手の行で分かれて左から入る', () => {
    for (const [eid, nid] of [['ra', 'A'], ['rb', 'B'], ['rc', 'C']] as const) {
      const g = layout.edges.get(eid)!;
      expect(g.points[g.points.length - 1]).toEqual(layout.nodes.get(nid)!.ports.left);
    }
  });

  it('警告が無く、free 枠は図の自然寸法になる', () => {
    expect(layout.warnings).toEqual([]);
    expect(layout.figure.y).toBe(layout.title.height);
    expect(layout.citation.y).toBe(layout.figure.y + layout.figure.height);
    expect(layout.caption).toBeUndefined();
  });
});

describe('resolveLayout: 同じ埋め込みモデルを往復する RAG', () => {
  const d = sampleRag();
  d.edges.push(
    { id: 'q1', from: 'query', to: 'embed', label: '同じモデル' },
    { id: 'q2', from: 'embed', to: 'search', label: 'ベクトル' },
  );
  const layout = resolveLayout(d, style, '4:5');

  it('警告が無い', () => {
    expect(layout.warnings).toEqual([]);
  });

  it('前向きの斜め辺は列チャネルとレーンの隙間を通って相手の下から入る', () => {
    const q1 = layout.edges.get('q1')!;
    const embed = layout.nodes.get('embed')!;
    expect(q1.points.length).toBe(5);
    expect(q1.points[q1.points.length - 1].y).toBe(embed.y + embed.h);
  });

  it('同じ辺に入る線と出る線は別のポートに分かれる', () => {
    const q1 = layout.edges.get('q1')!;
    const q2 = layout.edges.get('q2')!;
    const into = q1.points[q1.points.length - 1];
    const outOf = q2.points[0];
    expect(into.y).toBe(outOf.y);
    expect(Math.abs(into.x - outOf.x)).toBe(style.track);
  });

  it('同じ隙間を通る横線は track 刻みで別の高さになる', () => {
    const ys = ['q1', 'q2', 'e7'].map((id) => layout.edges.get(id)!.points[2].y);
    expect(new Set(ys).size).toBe(3);
    ys.sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBe(style.track);
    expect(ys[2] - ys[1]).toBe(style.track);
  });
});

describe('resolveLayout: 辺を指定した縦の往復', () => {
  const d = sampleRag();
  d.edges = d.edges.filter((e) => e.id !== 'e7' && e.id !== 'loop');
  d.edges.push(
    { id: 'up', from: 'query', to: 'embed', fromSide: 'top', toSide: 'bottom', label: '同じモデル' },
    { id: 'down', from: 'vdb', to: 'prompt', fromSide: 'bottom', toSide: 'top', label: '近いチャンク' },
  );
  const layout = resolveLayout(d, style, '4:5');

  it('x の範囲が重なる横セグメントは track 刻みで別の高さになる', () => {
    const up = layout.edges.get('up')!;
    const down = layout.edges.get('down')!;
    const a = layout.lanes.get('index')!;
    const b = layout.lanes.get('answer')!;
    for (const g of [up, down]) {
      expect(g.points.length).toBe(4);
      expect(g.points[1].y).toBeGreaterThan(a.y + a.height);
      expect(g.points[1].y).toBeLessThan(b.y);
    }
    expect(Math.abs(up.points[1].y - down.points[1].y)).toBe(style.track);
    expect(layout.warnings).toEqual([]);
  });

  it('x の範囲が離れた横セグメントは同じトラックを共有する', () => {
    const d2 = sampleRag();
    d2.edges = [
      { id: 'a', from: 'docs', to: 'search', fromSide: 'bottom', toSide: 'top' },
      { id: 'b', from: 'embed', to: 'llm', fromSide: 'bottom', toSide: 'top' },
    ];
    const l2 = resolveLayout(d2, style, '4:5');
    const a = l2.edges.get('a')!;
    const b = l2.edges.get('b')!;
    const gapTop = l2.lanes.get('index')!;
    expect(a.points[1].y).toBe(b.points[1].y);
    expect(a.points[1].y).toBe(gapTop.y + gapTop.height + style.grid.laneGap / 2);
    expect(l2.warnings).toEqual([]);
  });
});

describe('resolveLayout: 同じ辺どうしの同一レーン内エッジ', () => {
  const d: Diagram = {
    id: 'u-turn',
    title: '戻り',
    lanes: [{ id: 'a', label: '工程' }],
    nodes: [
      { id: 'n0', kind: 'generic', label: '執筆', lane: 'a', col: 0, row: 0 },
      { id: 'n1', kind: 'generic', label: '査読', lane: 'a', col: 1, row: 0 },
      { id: 'n2', kind: 'generic', label: '改訂', lane: 'a', col: 2, row: 0 },
      { id: 'x', kind: 'generic', label: '別の行', lane: 'a', col: 1, row: 1 },
    ],
    edges: [
      { id: 'f1', from: 'n0', to: 'n1' },
      { id: 'f2', from: 'n1', to: 'n2' },
      { id: 'back', from: 'n2', to: 'n1', fromSide: 'bottom', toSide: 'bottom', label: '再査読' },
      { id: 'over', from: 'n0', to: 'n2', fromSide: 'top', toSide: 'top', label: '飛ばす' },
    ],
    steps: [],
    sources: [],
  };
  const layout = resolveLayout(d, style, 'free');
  const lane = layout.lanes.get('a')!;

  it('両方 bottom ならレーン下端の外側を通る', () => {
    const back = layout.edges.get('back')!;
    expect(back.points[1].y).toBeGreaterThan(lane.y + lane.height);
    expect(back.points[2].y).toBe(back.points[1].y);
  });

  it('両方 top ならレーン上端の外側を通る', () => {
    const over = layout.edges.get('over')!;
    expect(over.points[1].y).toBeLessThan(lane.y);
    expect(over.points[2].y).toBe(over.points[1].y);
  });
});

describe('resolveLayout: ファンイン', () => {
  const d: Diagram = {
    id: 'fan-in',
    title: '統合',
    lanes: [{ id: 'a' }],
    nodes: [
      { id: 's1', kind: 'generic', label: '結果 1', lane: 'a', col: 0, row: 0 },
      { id: 's2', kind: 'generic', label: '結果 2', lane: 'a', col: 0, row: 1 },
      { id: 's3', kind: 'generic', label: '結果 3', lane: 'a', col: 0, row: 2 },
      { id: 'merge', kind: 'generic', label: '統合', lane: 'a', col: 2, row: 1 },
    ],
    edges: [
      { id: 'm1', from: 's1', to: 'merge' },
      { id: 'm2', from: 's2', to: 'merge' },
      { id: 'm3', from: 's3', to: 'merge' },
    ],
    steps: [],
    sources: [],
  };
  const layout = resolveLayout(d, style, 'free');

  it('3 本が相手の手前のチャネルで 1 本に束なる', () => {
    const m1 = layout.edges.get('m1')!;
    const m3 = layout.edges.get('m3')!;
    expect(m1.points[1].x).toBe(m3.points[1].x);
    const merge = layout.nodes.get('merge')!;
    expect(m1.points[1].x).toBeGreaterThan(layout.nodes.get('s1')!.x + layout.nodes.get('s1')!.w + style.grid.colWidth / 2);
    expect(m1.points[m1.points.length - 1]).toEqual(merge.ports.left);
    expect(layout.warnings).toEqual([]);
  });
});

describe('角丸', () => {
  it('sampleCorners の長さと roundedPathD の実長の差が 1% 未満', () => {
    const layout = resolveLayout(sampleRag(), style, '4:5');
    let checked = 0;
    for (const g of layout.edges.values()) {
      if (g.points.length < 3) continue;
      const sampled = buildSegments(sampleCorners(g.points, style.corner)).totalLen;
      const real = pathLength(g.d);
      expect(Math.abs(sampled - real) / real).toBeLessThan(0.01);
      expect(g.route.totalLen).toBe(sampled);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('短いセグメントでは半径を半分に縮める', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 6 }, { x: 200, y: 6 }];
    const d = roundedPathD(pts, 20);
    expect(d).toBe('M 0 0 L 97 0 Q 100 0 100 3 L 100 3 Q 100 6 103 6 L 200 6');
    expect(Math.abs(buildSegments(sampleCorners(pts, 20)).totalLen - pathLength(d)) / pathLength(d)).toBeLessThan(0.01);
  });

  it('r = 0 なら折れ線のまま', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(roundedPathD(pts, 0)).toBe('M 0 0 L 10 0 L 10 10');
    expect(sampleCorners(pts, 0)).toEqual(pts);
  });
});
