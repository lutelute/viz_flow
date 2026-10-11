import type { ReactNode } from 'react';
import type { DiagramEdge, DiagramGroup, DiagramNode, Lane, NodeKind, Payload, PayloadKind, Source, ToneId } from '../../model/diagram';
import type { EdgeGeom, NodeBox, Pt, Rect, Size, TextMeasurer } from '../../layout/types';
import type { CompiledStep, NodeState, ParticleFrame, Phase } from '../../timeline/types';
import type { FontFace, RenderCtx, Skin, SkinTokens } from '../types';
import { nodeGlyph } from '../icons';
import { Text, textHeight, wrapLines } from '../text';
import { formatSource } from '../sketch/skin';

// 製図・ブループリント風。方眼の上に直角の矩形と細い実線、藍 1 色のアクセント。
// 手描きの揺れは無く、ok / ng / warn は色ではなく線種で分ける。
// 部品記号（DOC / EMB / LLM）と引出線付きのタグで、図面の寸法記入に寄せる。

const BG = '#F4F6F8';
const FACE = '#FFFFFF';
const INK = '#1C2733';
const LINE = '#4A5663';
const LINE_SOFT = '#9AA5B1';
const GRID_MINOR = '#E3E8EC';
const GRID_MAJOR = '#CCD4DB';
const BLUE = '#1E5AA8';

const GOTHIC = 'BIZ UDGothic';
const MONO = 'M PLUS 1 Code';

const tone: Record<ToneId, string> = {
  ink: INK,
  accent1: BLUE,
  accent2: BLUE,
  accent3: BLUE,
  ok: BLUE,
  ng: INK,
  warn: INK,
  muted: LINE_SOFT,
};

const PART_CODE: Record<NodeKind, string> = {
  documents: 'DOC', chunker: 'CHK', embedding: 'EMB', vectordb: 'VDB', graphdb: 'GDB',
  retriever: 'RET', reranker: 'RRK', grader: 'GRD', router: 'RTR', prompt: 'PRM',
  llm: 'LLM', answer: 'ANS', user: 'USR', query: 'QRY', web: 'WEB', tool: 'TOL',
  agent: 'AGT', memory: 'MEM', policy: 'POL', encoder: 'ENC', index: 'IDX', generic: 'GEN', image: 'IMG', port: 'I/O',
};

const PAYLOAD_CODE: Record<PayloadKind, string> = {
  text: 'txt', query: 'q', vector: 'vec', chunks: 'ch', prompt: 'prm', answer: 'ans',
  image: 'img', graph: 'grf', score: 'scr', plan: 'pln', tokens: 'tok', compressed: 'cmp', generic: 'obj',
};

const CODE_FONT: FontFace = { family: MONO, size: 11, weight: 500 };
const CELL_FONT: FontFace = { family: MONO, size: 10, weight: 500 };
const COUNTER_FONT: FontFace = { family: MONO, size: 13, weight: 400 };

const FRAME_OUTER = 14;
const FRAME_INNER = 20;
const TAG_MAX_WIDTH = 73;
const DOCK_DX = -28;
const DOCK_DY = -36;

export const blueprintTokens: SkinTokens = {
  bg: BG,
  bg2: FACE,
  ink: INK,
  inkSoft: LINE,
  line: LINE,
  lineSoft: LINE_SOFT,
  tone,
  fill: {},
  payloadTone: {
    text: 'accent1', query: 'accent1', vector: 'accent1', chunks: 'accent1', prompt: 'accent1', answer: 'accent1',
    image: 'accent1', graph: 'accent1', score: 'accent1', plan: 'accent1', tokens: 'accent1', compressed: 'ink', generic: 'ink',
  },
  font: {
    title: { family: GOTHIC, size: 36, weight: 700 },
    subtitle: { family: GOTHIC, size: 18, weight: 400 },
    label: { family: GOTHIC, size: 20, weight: 700 },
    sublabel: { family: GOTHIC, size: 14, weight: 400 },
    edge: { family: MONO, size: 15, weight: 400 },
    badge: { family: MONO, size: 14, weight: 500 },
    caption: { family: GOTHIC, size: 24, weight: 400 },
    particle: { family: MONO, size: 12, weight: 400 },
    lane: { family: MONO, size: 15, weight: 500 },
    citation: { family: MONO, size: 12, weight: 400 },
  },
  stroke: { node: 1.6, edge: 1.6, lane: 1.2, group: 1.2, icon: 1.5 },
  radius: { node: 0, lane: 0, corner: 0 },
  arrow: { kind: 'triangle', size: 8 },
  particle: { size: 14, labelGap: 6 },
  grid: { colWidth: 246, rowHeight: 180, laneGap: 64, padding: 48, laneHeader: 40 },
  nodeMin: { sm: { w: 130, h: 96 }, md: { w: 162, h: 112 }, lg: { w: 190, h: 124 } },
  nodePad: 12,
  iconSize: 40,
  stub: 14,
  track: 14,
  texture: 'graph',
  dark: false,
};

/**
 * M PLUS 1 Code は全角 1em、半角 0.5em の厳密な等幅なので、canvas で測らず字種から出す。
 * Google Fonts の分割読み込みでは最初の描画時に欧文のスライスが未着のことがあり、
 * measure の値が別のフォントの幅になって箱と文字がずれるため。
 */
function monoWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const halfKana = cp >= 0xff61 && cp <= 0xff9f;
    const wide = (cp >= 0x2e80 && !halfKana) || (cp >= 0x2010 && cp <= 0x205e);
    em += wide ? 1 : 0.5;
  }
  return em * size;
}

const monoMeasurer: TextMeasurer = { width: (text, _family, size) => monoWidth(text, size) };

function glyphGroup(d: string[], x: number, y: number, size: number, color: string, width: number): ReactNode {
  const k = size / 24;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} fill="none" stroke={color} strokeWidth={width / k} strokeLinecap="square" strokeLinejoin="miter">
      {d.map((p, i) => <path key={i} d={p} />)}
    </g>
  );
}

function Defs(): ReactNode {
  return (
    <pattern id="bp-grid" width={100} height={100} patternUnits="userSpaceOnUse">
      <path d="M20.5 0V100M40.5 0V100M60.5 0V100M80.5 0V100M0 20.5H100M0 40.5H100M0 60.5H100M0 80.5H100" fill="none" stroke={GRID_MINOR} strokeWidth={1} />
      <path d="M0.5 0V100M0 0.5H100" fill="none" stroke={GRID_MAJOR} strokeWidth={1} />
    </pattern>
  );
}

function Background(_ctx: RenderCtx, size: Size): ReactNode {
  const { width: w, height: h } = size;
  const o = FRAME_OUTER;
  const i = FRAME_INNER;
  const ticks: string[] = [];
  for (let x = 50; x < w - i; x += 50) {
    const len = x % 100 === 0 ? i - o : (i - o) / 2;
    ticks.push(`M${x} ${o}v${len}`, `M${x} ${h - o}v${-len}`);
  }
  for (let y = 50; y < h - i; y += 50) {
    const len = y % 100 === 0 ? i - o : (i - o) / 2;
    ticks.push(`M${o} ${y}h${len}`, `M${w - o} ${y}h${-len}`);
  }
  return (
    <>
      <rect x={0} y={0} width={w} height={h} fill={BG} />
      <rect x={0} y={0} width={w} height={h} fill="url(#bp-grid)" />
      <rect x={o} y={o} width={w - o * 2} height={h - o * 2} fill="none" stroke={LINE} strokeWidth={1.5} />
      <rect x={i} y={i} width={w - i * 2} height={h - i * 2} fill="none" stroke={LINE_SOFT} strokeWidth={1} />
      <path d={ticks.join('')} fill="none" stroke={LINE} strokeWidth={1} />
    </>
  );
}

function Title(ctx: RenderCtx, rect: Rect, title: string, subtitle?: string): ReactNode {
  const t = ctx.skin.tokens;
  const subY = rect.y + t.font.title.size * 1.4;
  const subLines = subtitle ? wrapLines(subtitle, rect.width, ctx.measure, t.font.subtitle).slice(0, 2) : [];
  const ruleY = subLines.length ? subY + textHeight(subLines.length, t.font.subtitle) + 14 : rect.y + t.font.title.size + 14;
  return (
    <g>
      {Text({ x: rect.x, y: rect.y, lines: [title], font: t.font.title, fill: INK })}
      {subLines.length > 0 && Text({ x: rect.x, y: subY, lines: subLines, font: t.font.subtitle, fill: LINE })}
      <line x1={rect.x} y1={ruleY} x2={rect.x + rect.width} y2={ruleY} stroke={LINE} strokeWidth={1.2} />
    </g>
  );
}

// Lane は 1 つずつ呼ばれて配列順を受け取れないので、図ごとに呼び出し順で採番する
const laneNumbers = new Map<string, number>();

function laneNumber(ctx: RenderCtx, lane: Lane): number {
  const key = `${ctx.diagramId}:${lane.id}`;
  const hit = laneNumbers.get(key);
  if (hit !== undefined) return hit;
  let count = 0;
  for (const k of laneNumbers.keys()) if (k.startsWith(`${ctx.diagramId}:`)) count++;
  laneNumbers.set(key, count + 1);
  return count + 1;
}

function LaneOutline(ctx: RenderCtx, lane: Lane, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const frame = lane.frame ?? 'band';
  const parts: ReactNode[] = [];
  if (frame !== 'none') {
    parts.push(<rect key="frame" x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke={LINE_SOFT} strokeWidth={t.stroke.lane} />);
  }
  if (lane.label) {
    const n = String(laneNumber(ctx, lane)).padStart(2, '0');
    parts.push(<g key="label">{Text({ x: rect.x + 14, y: rect.y + 11, lines: [`LANE ${n} ｜ ${lane.label}`], font: t.font.lane, fill: INK })}</g>);
  }
  return <g>{parts}</g>;
}

function Group(ctx: RenderCtx, group: DiagramGroup, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const color = group.tone ? t.tone[group.tone] : LINE;
  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke={color} strokeWidth={t.stroke.group} strokeDasharray="6 4" />
      {group.label && Text({ x: rect.x + 10, y: rect.y - t.font.lane.size * 1.4, lines: [group.label], font: { ...t.font.lane, weight: 400 }, fill: color })}
    </g>
  );
}

function Node(ctx: RenderCtx, node: DiagramNode, box: NodeBox, state: NodeState): ReactNode {
  const t = ctx.skin.tokens;
  const muted = node.emphasis === 'muted';
  const active = state.phase === 'active' || state.phase === 'processing';
  const strokeColor = active ? BLUE : muted ? LINE_SOFT : INK;
  const strokeW = active ? 2.4 : t.stroke.node;
  const pulse = state.pulse ?? 0;
  const scale = 1 + pulse * 0.03;

  const code = PART_CODE[node.kind] ?? PART_CODE.generic;
  const codeX = box.x + 7;
  const codeY = box.y + 5;
  const codeW = monoWidth(code, CODE_FONT.size);

  const iconSize = t.iconSize;
  const iconColor = muted ? LINE_SOFT : INK;
  const labelH = textHeight(box.labelLines.length, t.font.label, 1.2);
  const subH = box.sublabelLines.length ? textHeight(box.sublabelLines.length, t.font.sublabel, 1.25) + 4 : 0;
  const contentH = iconSize + 8 + labelH + subH;
  const top = box.cy - contentH / 2;

  return (
    <g transform={scale === 1 ? undefined : `translate(${box.cx} ${box.cy}) scale(${scale}) translate(${-box.cx} ${-box.cy})`}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={FACE} stroke={strokeColor} strokeWidth={strokeW} />
      {Text({ x: codeX, y: codeY, lines: [code], font: CODE_FONT, fill: muted ? LINE_SOFT : LINE })}
      {node.emphasis === 'new' && <line x1={codeX} y1={codeY + CODE_FONT.size + 4} x2={codeX + codeW} y2={codeY + CODE_FONT.size + 4} stroke={BLUE} strokeWidth={1.5} />}
      {glyphGroup(nodeGlyph(node.kind, node.icon), box.cx - iconSize / 2, top, iconSize, iconColor, t.stroke.icon)}
      {Text({ x: box.cx, y: top + iconSize + 8, lines: box.labelLines, font: t.font.label, fill: muted ? LINE : INK, anchor: 'middle', leading: 1.2 })}
      {box.sublabelLines.length > 0 &&
        Text({ x: box.cx, y: top + iconSize + 8 + labelH + 4, lines: box.sublabelLines, font: t.font.sublabel, fill: LINE, anchor: 'middle', leading: 1.25 })}
      {state.phase === 'processing' && progressArc(box, state.progress ?? 0)}
      {state.phase === 'done' && doneMark(box)}
    </g>
  );
}

function progressArc(box: NodeBox, p: number): ReactNode {
  const r = 7;
  const cx = box.x + box.w - 13;
  const cy = box.y + 13;
  const a = Math.max(0.001, Math.min(0.999, p)) * Math.PI * 2;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = a > Math.PI ? 1 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={FACE} stroke={LINE_SOFT} strokeWidth={1.2} />
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x} ${y}`} fill="none" stroke={BLUE} strokeWidth={2} />
    </g>
  );
}

function doneMark(box: NodeBox): ReactNode {
  return <rect x={box.x + box.w - 16} y={box.y + 9} width={7} height={7} fill={BLUE} />;
}

function dashOf(edge: DiagramEdge): string | undefined {
  if (edge.line === 'solid') return undefined;
  if (edge.line === 'dashed') return '6 4';
  if (edge.line === 'dotted') return '2 4';
  if (edge.tone === 'ng') return '6 4';
  if (edge.tone === 'warn') return '2 4';
  const role = edge.role ?? 'main';
  return role === 'loop' || role === 'ref' ? '6 4' : undefined;
}

function Edge(ctx: RenderCtx, edge: DiagramEdge, geom: EdgeGeom, phase: Phase): ReactNode {
  const t = ctx.skin.tokens;
  const base = edge.tone ? t.tone[edge.tone] : LINE;
  const color = phase === 'active' ? BLUE : phase === 'pending' ? LINE_SOFT : base;
  const width = phase === 'active' ? 2.2 : t.stroke.edge;
  const parts: ReactNode[] = [
    <path key="line" d={geom.d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dashOf(edge)} strokeLinejoin="miter" />,
  ];

  if (edge.arrow !== 'none') {
    parts.push(triangle('end', geom.arrowAt, geom.arrowAngle, color, t.arrow.size));
    if (edge.arrow === 'both') {
      const p0 = geom.points[0];
      const p1 = geom.points[1] ?? p0;
      const ang = (Math.atan2(p0.y - p1.y, p0.x - p1.x) * 180) / Math.PI;
      parts.push(triangle('start', p0, ang, color, t.arrow.size));
    }
  }

  if (geom.label) {
    const b = geom.label.box;
    parts.push(
      <g key="label">
        <rect x={b.x - 5} y={b.y - 3} width={b.width + 10} height={b.height + 6} fill={FACE} stroke={LINE_SOFT} strokeWidth={1.2} />
        {Text({ x: geom.label.pos.x, y: b.y, lines: geom.label.lines, font: t.font.edge, fill: phase === 'pending' ? LINE : INK, anchor: geom.label.anchor, leading: 1.25 })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

function triangle(key: string, at: Pt, angleDeg: number, color: string, size: number): ReactNode {
  return <path key={key} transform={`translate(${at.x} ${at.y}) rotate(${angleDeg})`} d={`M0 0 L${-size} ${-size * 0.4} L${-size} ${size * 0.4} Z`} fill={color} />;
}

/** 引出線の先のタグ文字。短いラベルはそのまま、長ければ記号に落とす。 */
function tagOf(ctx: RenderCtx, p: Payload): string | undefined {
  const f = ctx.skin.tokens.font.particle;
  if (p.label) {
    if (monoWidth(p.label, f.size) <= TAG_MAX_WIDTH) return p.label;
  } else if (ctx.mode === 'static') {
    return undefined;
  }
  const code = PAYLOAD_CODE[p.kind] ?? PAYLOAD_CODE.generic;
  return p.kind === 'chunks' && (p.count ?? 1) > 1 ? `${code}×${p.count}` : code;
}

/**
 * 進行方向の右手側に 12px の引出線を立て、その先にタグを置く（右向きなら下、下向きなら左）。
 * 左手側はバッジと辺ラベルが使う。斜めに出すと短い辺では隣のノードに掛かる。
 */
function callout(ctx: RenderCtx, tag: string, color: string, r: number, heading: number): ReactNode {
  const f = ctx.skin.tokens.font.particle;
  const w = monoWidth(tag, f.size);
  const rad = (heading * Math.PI) / 180;
  const rx = -Math.sin(rad);
  const ry = Math.cos(rad);
  const n = Math.abs(ry) >= Math.abs(rx) ? { x: 0, y: Math.sign(ry) || 1 } : { x: Math.sign(rx) || 1, y: 0 };
  const lead = 12;
  const bh = f.size + 6;
  const bw = w + 8;
  const ex = n.x * (r + lead);
  const ey = n.y * (r + lead);
  const bx = n.x === 0 ? ex - bw / 2 : n.x > 0 ? ex : ex - bw;
  const by = n.y === 0 ? ey - bh / 2 : n.y > 0 ? ey : ey - bh;
  return (
    <g>
      <line x1={n.x * r} y1={n.y * r} x2={ex} y2={ey} stroke={color} strokeWidth={1.5} />
      <rect x={bx} y={by} width={bw} height={bh} fill={FACE} stroke={LINE_SOFT} strokeWidth={1.2} />
      {Text({ x: bx + 4, y: by + 3, lines: [tag], font: f, fill: color })}
    </g>
  );
}

function Particle(ctx: RenderCtx, pf: ParticleFrame): ReactNode {
  const t = ctx.skin.tokens;
  const r = t.particle.size / 2;

  let scale = 1;
  let shown: Payload = pf.payload;
  if (pf.phase === 'morph' && pf.morphFrom) {
    if (pf.phaseT < 0.5) {
      shown = pf.morphFrom;
      scale = 1 - pf.phaseT * 1.6;
    } else {
      scale = 0.2 + (pf.phaseT - 0.5) * 1.6;
    }
  } else if (pf.phase === 'fade') {
    scale = 1 - pf.phaseT;
  }
  if (scale <= 0.02) return null;
  // ノードの中で待つ間は部品記号とアイコンの間に小さく置く
  const docked = pf.phase !== 'travel';
  const dx = docked ? DOCK_DX : 0;
  const dy = docked ? DOCK_DY : 0;
  if (docked) scale *= 0.75;
  const color = t.tone[shown.tone ?? t.payloadTone[shown.kind]];
  const tag = pf.phase === 'travel' && scale > 0.6 ? tagOf(ctx, shown) : undefined;

  return (
    <g transform={`translate(${pf.x + dx} ${pf.y + dy})`}>
      <g transform={scale === 1 ? undefined : `scale(${scale})`}>
        <circle r={r} fill={FACE} stroke={color} strokeWidth={1.5} strokeDasharray={shown.ghost ? '3 2' : undefined} />
        <circle r={1.5} fill={color} />
      </g>
      {tag && callout(ctx, tag, color, r, pf.heading)}
    </g>
  );
}

function Badge(ctx: RenderCtx, n: number, pos: Pt, phase: Phase, short?: string): ReactNode {
  const t = ctx.skin.tokens;
  const r = 11;
  const face = phase === 'active' ? BLUE : FACE;
  const ring = phase === 'pending' ? LINE_SOFT : BLUE;
  const num = phase === 'active' ? FACE : phase === 'pending' ? LINE_SOFT : BLUE;
  const f = t.font.edge;
  const shortW = short ? monoWidth(short, f.size) : 0;
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}>
      <circle r={r} fill={face} stroke={ring} strokeWidth={phase === 'pending' ? 1.2 : 1.5} />
      {Text({ x: 0, y: 0, lines: [String(n)], font: t.font.badge, fill: num, anchor: 'middle', valign: 'middle' })}
      {short && phase === 'active' && (
        <g>
          <rect x={r + 5} y={-f.size / 2 - 3} width={shortW + 8} height={f.size + 6} fill={FACE} stroke={BLUE} strokeWidth={1.2} />
          {Text({ x: r + 9, y: 0, lines: [short], font: f, fill: BLUE, valign: 'middle' })}
        </g>
      )}
    </g>
  );
}

function CaptionStrip(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], active: number): ReactNode {
  const t = ctx.skin.tokens;
  const f = t.font.caption;
  if (active < 0 || !steps[active]) return stepList(ctx, rect, steps);
  const st = steps[active];
  const lines = wrapLines(st.caption, rect.width - 44, ctx.measure, f).slice(0, 3);
  return (
    <g>
      {Badge(ctx, st.n, { x: rect.x + 12, y: rect.y + f.size * 0.62 }, 'active')}
      {Text({ x: rect.x + 34, y: rect.y, lines, font: f, fill: INK, leading: 1.4 })}
      {Text({ x: rect.x + rect.width, y: rect.y + rect.height - COUNTER_FONT.size, lines: [`${st.n} / ${steps.length}`], font: COUNTER_FONT, fill: LINE, anchor: 'end' })}
    </g>
  );
}

/** 番号付きの一覧を 2 段組で。帯の高さに収まるまで文字を 17px から 13px まで段階的に小さくする。 */
function stepList(ctx: RenderCtx, rect: Rect, steps: CompiledStep[]): ReactNode {
  const f = ctx.skin.tokens.font.caption;
  const cols = steps.length > 4 ? 2 : 1;
  const colW = rect.width / cols;
  const per = Math.ceil(steps.length / cols);
  const leading = 1.4;
  let font: FontFace = { ...f, size: 17 };
  let gap = 8;
  let columns: string[][][] = [];
  for (const size of [17, 15, 14, 13]) {
    font = { ...f, size };
    gap = size >= 15 ? 8 : 6;
    columns = [];
    let tallest = 0;
    for (let c = 0; c < cols; c++) {
      const col = steps.slice(c * per, (c + 1) * per).map((s) => wrapLines(s.caption, colW - 52, ctx.measure, font).slice(0, 2));
      columns.push(col);
      const h = col.reduce((acc, lines) => acc + textHeight(lines.length, font, leading), 0) + gap * (col.length - 1);
      tallest = Math.max(tallest, h);
    }
    if (tallest <= rect.height) break;
  }
  const items: ReactNode[] = [];
  columns.forEach((col, c) => {
    const x = rect.x + c * colW;
    let y = rect.y;
    col.forEach((lines, i) => {
      const s = steps[c * per + i];
      items.push(
        <g key={s.index}>
          {Badge(ctx, s.n, { x: x + 12, y: y + 11 }, 'done')}
          {Text({ x: x + 32, y, lines, font, fill: INK, leading })}
        </g>,
      );
      y += textHeight(lines.length, font, leading) + gap;
    });
  });
  return <g>{items}</g>;
}

/** 表題欄。出典と図番を細線の枠に入れ、右下に寄せる。出典が長いときだけ幅いっぱいに広げて 2 行にする。 */
function Citation(ctx: RenderCtx, rect: Rect, sources: Source[]): ReactNode {
  const t = ctx.skin.tokens;
  if (sources.length === 0) return null;
  const f = t.font.citation;
  const id = ctx.diagramId;
  const cellLabelW = 46;
  const pad = 8;
  const idW = Math.ceil(monoWidth(id, f.size)) + pad * 2;
  const text = sources.map(formatSource).join(' ／ ');
  const maxTextW = rect.width - cellLabelW * 2 - idW;
  const textW = Math.min(maxTextW, Math.ceil(monoWidth(text, f.size)) + pad * 2);
  const lines = wrapLines(text, textW - pad * 2, monoMeasurer, f).slice(0, 2);
  const w = cellLabelW * 2 + textW + idW;
  const x0 = rect.x + rect.width - w;
  const textX = x0 + cellLabelW;
  const idCellX = textX + textW;
  const my = rect.y + rect.height / 2;
  return (
    <g>
      <rect x={x0} y={rect.y} width={w} height={rect.height} fill={FACE} stroke={LINE} strokeWidth={1.2} />
      <path d={`M${textX} ${rect.y}v${rect.height}M${idCellX} ${rect.y}v${rect.height}M${idCellX + cellLabelW} ${rect.y}v${rect.height}`} fill="none" stroke={LINE_SOFT} strokeWidth={1.2} />
      {Text({ x: x0 + cellLabelW / 2, y: my, lines: ['出典'], font: CELL_FONT, fill: LINE, anchor: 'middle', valign: 'middle' })}
      {Text({ x: textX + pad, y: my, lines, font: f, fill: INK, valign: 'middle', leading: 1.3 })}
      {Text({ x: idCellX + cellLabelW / 2, y: my, lines: ['図番'], font: CELL_FONT, fill: LINE, anchor: 'middle', valign: 'middle' })}
      {Text({ x: idCellX + cellLabelW + pad, y: my, lines: [id], font: f, fill: INK, valign: 'middle' })}
    </g>
  );
}

export const blueprintSkin: Skin = {
  id: 'blueprint',
  name: '製図',
  tokens: blueprintTokens,
  fonts: [
    { family: GOTHIC, googleId: 'BIZ+UDGothic', weights: [400, 700] },
    { family: MONO, googleId: 'M+PLUS+1+Code', weights: [400, 500] },
  ],
  Defs,
  Background,
  Title,
  Lane: LaneOutline,
  Group,
  Node,
  Edge,
  Particle,
  Badge,
  CaptionStrip,
  Citation,
};
