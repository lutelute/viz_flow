import type { ReactNode } from 'react';
import type { DiagramEdge, DiagramGroup, DiagramNode, Lane, NodeKind, Payload, PayloadKind, Source, ToneId } from '../../model/diagram';
import type { EdgeGeom, NodeBox, Pt, Rect, Size } from '../../layout/types';
import type { CompiledStep, NodeState, ParticleFrame, Phase } from '../../timeline/types';
import type { RenderCtx, Skin, SkinTokens } from '../types';
import { nodeGlyph, payloadGlyph } from '../icons';
import { Text, textHeight, wrapLines } from '../text';

// 誌面・編集インフォグラフィック風。無地の紙、細い罫、明朝の見出し、墨と朱と藍の 3 色。
// 箱は極薄の面だけで線を持たず、意味は配線と記号と番号で伝える。

const PAPER = '#FBFAF6';
const FACE = '#F1EEE6';
const FACE_ACTIVE = '#F6E3DE';
const INK = '#1B1B1B';
const INK_SOFT = '#5F5B55';
const LINE = '#3A3733';
const LINE_SOFT = '#B8B2A6';
const RULE = '#D8D4CC';
const VERMILION = '#C2412D';
const INDIGO = '#2B5F8C';

const tone: Record<ToneId, string> = {
  ink: INK,
  accent1: INDIGO,
  accent2: VERMILION,
  accent3: INDIGO,
  ok: INDIGO,
  ng: VERMILION,
  warn: VERMILION,
  muted: LINE_SOFT,
};

const fill: Partial<Record<NodeKind, string>> = {
  documents: FACE, chunker: FACE, vectordb: FACE, graphdb: FACE, index: FACE, memory: FACE,
  embedding: FACE, encoder: FACE, llm: FACE, agent: FACE, policy: FACE,
  grader: FACE, router: FACE, reranker: FACE, retriever: FACE,
  user: FACE, query: FACE, answer: FACE, prompt: FACE, web: FACE, tool: FACE,
  generic: FACE,
};

const MINCHO = 'Shippori Mincho B1';
const GOTHIC = 'Zen Kaku Gothic New';

const RULE_WIDTH = 0.75;
const PAGE_RULE_GAP = 36;
const PAGE_RULE_MIN = 24;
const EDGE_TRACKING = 0.02;
const CITATION_TRACKING = 0.04;
const PARTICLE_R = 9;
const BADGE_R = 12;

export const editorialTokens: SkinTokens = {
  bg: PAPER,
  bg2: FACE,
  ink: INK,
  inkSoft: INK_SOFT,
  line: LINE,
  lineSoft: LINE_SOFT,
  tone,
  fill,
  payloadTone: {
    text: 'ink', query: 'accent2', vector: 'accent1', chunks: 'accent1', prompt: 'accent2', answer: 'ok',
    image: 'accent1', graph: 'accent1', score: 'warn', plan: 'accent2', tokens: 'accent1', compressed: 'ink', generic: 'ink',
  },
  font: {
    title: { family: MINCHO, size: 44, weight: 700 },
    subtitle: { family: GOTHIC, size: 16, weight: 500 },
    label: { family: GOTHIC, size: 21, weight: 700 },
    sublabel: { family: GOTHIC, size: 14, weight: 500 },
    edge: { family: GOTHIC, size: 13, weight: 500 },
    badge: { family: MINCHO, size: 16, weight: 700 },
    caption: { family: GOTHIC, size: 24, weight: 500 },
    particle: { family: GOTHIC, size: 12, weight: 500 },
    lane: { family: MINCHO, size: 18, weight: 700 },
    citation: { family: GOTHIC, size: 11, weight: 500 },
  },
  stroke: { node: 0, edge: 1.5, lane: RULE_WIDTH, group: 1.5, icon: 1.75 },
  radius: { node: 14, lane: 0, corner: 12 },
  arrow: { kind: 'triangle-small', size: 7 },
  particle: { size: PARTICLE_R * 2, labelGap: 5 },
  grid: { colWidth: 246, rowHeight: 180, laneGap: 64, padding: 48, laneHeader: 40 },
  nodeMin: { sm: { w: 130, h: 96 }, md: { w: 162, h: 112 }, lg: { w: 190, h: 124 } },
  nodePad: 12,
  iconSize: 40,
  stub: 14,
  track: 14,
  texture: 'none',
  dark: false,
};

function glyphGroup(d: string[], x: number, y: number, size: number, color: string, width: number, key: string, dash?: string): ReactNode {
  const k = size / 24;
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${k})`} fill="none" stroke={color} strokeWidth={width / k} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash}>
      {d.map((p, i) => <path key={i} d={p} />)}
    </g>
  );
}

function rule(key: string, x1: number, x2: number, y: number, color = RULE, width = RULE_WIDTH): ReactNode {
  return <line key={key} x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={width} />;
}

function symbolId(kind: PayloadKind, ghost: boolean | undefined): string {
  return `pl-editorial-${kind}${ghost ? '-ghost' : ''}`;
}

function Defs(ctx: RenderCtx): ReactNode {
  const t = ctx.skin.tokens;
  const kinds = Object.keys(t.payloadTone) as PayloadKind[];
  const symbols: ReactNode[] = [];
  const glyphSize = 12;
  for (const kind of kinds) {
    const color = t.tone[t.payloadTone[kind]];
    const solid = symbolId(kind, false);
    const ghost = symbolId(kind, true);
    symbols.push(
      <symbol key={solid} id={solid} overflow="visible">
        <circle r={PARTICLE_R} fill={color} />
        {glyphGroup(payloadGlyph(kind), -glyphSize / 2, -glyphSize / 2, glyphSize, PAPER, 1.5, `g-${solid}`)}
      </symbol>,
      <symbol key={ghost} id={ghost} overflow="visible">
        <circle r={PARTICLE_R} fill={PAPER} stroke={color} strokeWidth={1.5} strokeDasharray="3 2.5" />
        {glyphGroup(payloadGlyph(kind), -glyphSize / 2, -glyphSize / 2, glyphSize, color, 1.5, `g-${ghost}`)}
      </symbol>,
    );
  }
  return <>{symbols}</>;
}

function Background(_ctx: RenderCtx, size: Size): ReactNode {
  return <rect x={0} y={0} width={size.width} height={size.height} fill={PAPER} />;
}

/** 題名の上に紙の上端の罫を引く。題名が紙の端に寄る free 枠では引かない。 */
function Title(ctx: RenderCtx, rect: Rect, title: string, subtitle?: string): ReactNode {
  const t = ctx.skin.tokens;
  const titleLines = wrapLines(title, rect.width, ctx.measure, t.font.title);
  const titleH = textHeight(titleLines.length, t.font.title, 1.2);
  const subLines = subtitle ? wrapLines(subtitle, rect.width, ctx.measure, t.font.subtitle).slice(0, 2) : [];
  const subY = rect.y + titleH + 14;
  const subH = subLines.length ? textHeight(subLines.length, t.font.subtitle, 1.4) : 0;
  const ruleY = Math.min(rect.y + rect.height - 4, subY + subH + 16);
  const pageRuleY = rect.y - PAGE_RULE_GAP;
  return (
    <g>
      {pageRuleY >= PAGE_RULE_MIN && rule('page-top', rect.x, rect.x + rect.width, Math.max(PAGE_RULE_MIN, pageRuleY))}
      {Text({ x: rect.x, y: rect.y, lines: titleLines, font: t.font.title, fill: INK, leading: 1.2 })}
      {subLines.length > 0 && Text({ x: rect.x, y: subY, lines: subLines, font: t.font.subtitle, fill: INK_SOFT, leading: 1.4 })}
      {rule('title-rule', rect.x, rect.x + rect.width, ruleY)}
    </g>
  );
}

function LaneRule(ctx: RenderCtx, lane: Lane, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  if (lane.frame === 'none' && !lane.label) return null;
  const color = lane.tone ? t.tone[lane.tone] : INK;
  const parts: ReactNode[] = [rule(`lane-rule-${lane.id}`, rect.x, rect.x + rect.width, rect.y)];
  if (lane.label) {
    parts.push(<line key="tick" x1={rect.x} x2={rect.x + 36} y1={rect.y} y2={rect.y} stroke={color} strokeWidth={2} />);
    parts.push(Text({ x: rect.x, y: rect.y + 10, lines: [lane.label], font: t.font.lane, fill: INK }));
  }
  return <g>{parts}</g>;
}

function Group(ctx: RenderCtx, group: DiagramGroup, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const color = group.tone ? t.tone[group.tone] : LINE;
  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={12} fill="none" stroke={color} strokeWidth={t.stroke.group} strokeDasharray="4 4" />
      {group.label && Text({ x: rect.x + 12, y: rect.y - t.font.sublabel.size * 1.3, lines: [group.label], font: t.font.sublabel, fill: color })}
    </g>
  );
}

function Node(ctx: RenderCtx, node: DiagramNode, box: NodeBox, state: NodeState): ReactNode {
  const t = ctx.skin.tokens;
  const muted = node.emphasis === 'muted';
  const active = state.phase === 'active' || state.phase === 'processing';
  const face = active ? FACE_ACTIVE : (fill[node.kind] ?? FACE);
  const iconColor = active ? VERMILION : muted ? LINE_SOFT : INK;
  const labelColor = muted ? INK_SOFT : INK;
  const pulse = state.pulse ?? 0;
  const scale = 1 + pulse * 0.03;

  const iconSize = t.iconSize;
  const labelH = textHeight(box.labelLines.length, t.font.label, 1.2);
  const subH = box.sublabelLines.length ? textHeight(box.sublabelLines.length, t.font.sublabel, 1.25) + 4 : 0;
  const contentH = iconSize + 8 + labelH + subH;
  const top = box.cy - contentH / 2;

  return (
    <g transform={`translate(${box.cx} ${box.cy}) scale(${scale}) translate(${-box.cx} ${-box.cy})`}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={t.radius.node} fill={face} stroke={node.emphasis === 'new' ? VERMILION : 'none'} strokeWidth={1.5} />
      {glyphGroup(nodeGlyph(node.kind, node.icon), box.cx - iconSize / 2, top, iconSize, iconColor, t.stroke.icon, `icon-${node.id}`)}
      {Text({ x: box.cx, y: top + iconSize + 8, lines: box.labelLines, font: t.font.label, fill: labelColor, anchor: 'middle', leading: 1.2 })}
      {box.sublabelLines.length > 0 &&
        Text({ x: box.cx, y: top + iconSize + 8 + labelH + 4, lines: box.sublabelLines, font: t.font.sublabel, fill: INK_SOFT, anchor: 'middle', leading: 1.25 })}
      {state.phase === 'processing' && progressArc(box, state.progress ?? 0)}
      {state.phase === 'done' && <circle cx={box.x + box.w - 13} cy={box.y + 13} r={3.5} fill={VERMILION} />}
    </g>
  );
}

function progressArc(box: NodeBox, p: number): ReactNode {
  const r = 8;
  const cx = box.x + box.w - 14;
  const cy = box.y + 14;
  const a = Math.max(0.001, Math.min(0.999, p)) * Math.PI * 2;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = a > Math.PI ? 1 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={LINE_SOFT} strokeWidth={1.5} />
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x} ${y}`} fill="none" stroke={VERMILION} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Edge(ctx: RenderCtx, edge: DiagramEdge, geom: EdgeGeom, phase: Phase): ReactNode {
  const t = ctx.skin.tokens;
  const role = edge.role ?? 'main';
  const base = edge.tone ? t.tone[edge.tone] : LINE;
  const color = phase === 'active' ? VERMILION : phase === 'pending' ? LINE_SOFT : base;
  const width = phase === 'active' ? 2 : t.stroke.edge;
  const dash = role === 'loop' || role === 'ref' || edge.line === 'dashed' ? '5 5' : edge.line === 'dotted' ? '1.5 4' : undefined;

  const parts: ReactNode[] = [
    <path key="line" d={geom.d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />,
  ];

  if (edge.arrow !== 'none') {
    parts.push(arrowHead(`${edge.id}:end`, geom.arrowAt, geom.arrowAngle, color, t.arrow.size));
    if (edge.arrow === 'both') {
      const p0 = geom.points[0];
      const p1 = geom.points[1] ?? p0;
      const ang = (Math.atan2(p0.y - p1.y, p0.x - p1.x) * 180) / Math.PI;
      parts.push(arrowHead(`${edge.id}:start`, p0, ang, color, t.arrow.size));
    }
  }

  if (geom.label) {
    const f = t.font.edge;
    const b = geom.label.box;
    const tracking = f.size * EDGE_TRACKING;
    const slack = tracking * Math.max(...geom.label.lines.map((l) => l.length));
    parts.push(
      <g key="label">
        <rect x={b.x - 5} y={b.y - 2} width={b.width + 10 + slack} height={b.height + 4} fill={PAPER} />
        {Text({ x: geom.label.pos.x, y: b.y, lines: geom.label.lines, font: f, fill: phase === 'pending' ? INK_SOFT : INK, anchor: geom.label.anchor, leading: 1.25, letterSpacing: tracking })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

function arrowHead(key: string, at: Pt, angleDeg: number, color: string, size: number): ReactNode {
  const half = size * 0.5;
  return (
    <path
      key={key}
      d={`M0 0 L${-size} ${-half} L${-size} ${half} Z`}
      fill={color}
      stroke={color}
      strokeWidth={1}
      strokeLinejoin="round"
      transform={`translate(${at.x} ${at.y}) rotate(${angleDeg})`}
    />
  );
}

function Particle(ctx: RenderCtx, pf: ParticleFrame): ReactNode {
  const t = ctx.skin.tokens;
  const color = t.tone[pf.payload.tone ?? t.payloadTone[pf.payload.kind]];

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
  // ノードの中で待つ間はラベルと重ならないよう箱の左上寄りに小さく置く
  const docked = pf.phase !== 'travel';
  const dx = docked ? -50 : 0;
  const dy = docked ? -34 : 0;
  if (docked) scale *= 0.75;
  const sym = symbolId(shown.kind, shown.ghost);
  // ノードの中にいる間はノードのラベルと重なるので、粒子のラベルは移動中だけ出す
  const label = pf.phase === 'travel' ? shown.label : undefined;
  const stacked = shown.kind === 'chunks' && (shown.count ?? 1) >= 3;
  const f = t.font.particle;
  const labelW = label ? ctx.measure.width(label, f.family, f.size, f.weight) : 0;
  const labelY = PARTICLE_R + t.particle.labelGap;

  return (
    <g transform={`translate(${pf.x + dx} ${pf.y + dy}) scale(${scale})`}>
      {stacked && <circle cx={7} cy={-7} r={PARTICLE_R} fill={shown.ghost ? PAPER : color} stroke={shown.ghost ? color : PAPER} strokeWidth={1.5} />}
      {stacked && <circle cx={3.5} cy={-3.5} r={PARTICLE_R} fill={shown.ghost ? PAPER : color} stroke={shown.ghost ? color : PAPER} strokeWidth={1.5} />}
      <use href={`#${sym}`} />
      {label && scale > 0.6 && (
        <g transform={`scale(${1 / scale})`}>
          <rect x={-labelW / 2 - 3} y={labelY - 2} width={labelW + 6} height={f.size + 4} fill={PAPER} />
          {Text({ x: 0, y: labelY, lines: [label], font: f, fill: color, anchor: 'middle' })}
        </g>
      )}
    </g>
  );
}

function Badge(ctx: RenderCtx, n: number, pos: Pt, phase: Phase, short?: string): ReactNode {
  const t = ctx.skin.tokens;
  const face = phase === 'active' ? INK : PAPER;
  const ring = phase === 'pending' ? LINE_SOFT : INK;
  const num = phase === 'active' ? PAPER : phase === 'pending' ? LINE_SOFT : INK;
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}>
      <circle r={BADGE_R} fill={face} stroke={ring} strokeWidth={1.5} />
      {Text({ x: 0, y: 1, lines: [String(n)], font: t.font.badge, fill: num, anchor: 'middle', valign: 'middle' })}
      {short && phase === 'active' && Text({ x: BADGE_R + 8, y: 0, lines: [short], font: t.font.edge, fill: VERMILION, valign: 'middle', letterSpacing: t.font.edge.size * EDGE_TRACKING })}
    </g>
  );
}

function CaptionStrip(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], active: number): ReactNode {
  const t = ctx.skin.tokens;
  const f = t.font.caption;
  if (active < 0 || !steps[active]) return captionIndex(ctx, rect, steps);
  const st = steps[active];
  const lines = wrapLines(st.caption, rect.width - 60, ctx.measure, f).slice(0, 3);
  return (
    <g>
      {Badge(ctx, st.n, { x: rect.x + BADGE_R, y: rect.y + f.size * 0.6 }, 'active')}
      {Text({ x: rect.x + 48, y: rect.y, lines, font: f, fill: INK, leading: 1.45 })}
      {Text({ x: rect.x + rect.width, y: rect.y + rect.height - t.font.sublabel.size, lines: [`${st.n} / ${steps.length}`], font: t.font.sublabel, fill: INK_SOFT, anchor: 'end' })}
    </g>
  );
}

const INDEX_SIZES = [17, 16, 15, 14, 13];
const INDEX_GUTTER = 32;
const INDEX_INDENT = 26;
const INDEX_LEADING = 1.45;

interface IndexPlan { size: number; cols: number; colW: number; lines: string[][]; height: number }

/** 字の大きさと段数を順に試し、帯の高さに収まる最初の組み合わせを選ぶ。 */
function planIndex(ctx: RenderCtx, rect: Rect, steps: CompiledStep[]): IndexPlan {
  const base = ctx.skin.tokens.font.caption;
  const colChoices = steps.length > 4 ? [2, 3] : [1, 2];
  let fallback: IndexPlan | null = null;
  for (const size of INDEX_SIZES) {
    for (const cols of colChoices) {
      const colW = (rect.width - INDEX_GUTTER * (cols - 1)) / cols;
      const font = { ...base, size };
      const lines = steps.map((s) => wrapLines(s.caption, colW - INDEX_INDENT, ctx.measure, font));
      const per = Math.ceil(steps.length / cols);
      let height = 0;
      for (let c = 0; c < cols; c++) {
        const col = lines.slice(c * per, (c + 1) * per);
        const h = col.reduce((acc, l) => acc + textHeight(l.length, font, INDEX_LEADING) + size * 0.5, 0);
        height = Math.max(height, h);
      }
      const plan = { size, cols, colW, lines, height };
      if (height <= rect.height) return plan;
      fallback = plan;
    }
  }
  return fallback!;
}

/** 静止表示の番号付き一覧。明朝の数字をぶら下げ、本文は段組にする。 */
function captionIndex(ctx: RenderCtx, rect: Rect, steps: CompiledStep[]): ReactNode {
  const t = ctx.skin.tokens;
  const plan = planIndex(ctx, rect, steps);
  const body = { ...t.font.caption, size: plan.size };
  const numFont = { ...t.font.badge, size: plan.size };
  const per = Math.ceil(steps.length / plan.cols);
  const items: ReactNode[] = [];
  for (let c = 0; c < plan.cols; c++) {
    const x = rect.x + c * (plan.colW + INDEX_GUTTER);
    let y = rect.y;
    steps.slice(c * per, (c + 1) * per).forEach((s, i) => {
      const lines = plan.lines[c * per + i];
      items.push(
        <g key={s.index}>
          {Text({ x: x + INDEX_INDENT - 8, y: y + 1, lines: [String(s.n)], font: numFont, fill: VERMILION, anchor: 'end' })}
          {Text({ x: x + INDEX_INDENT, y, lines, font: body, fill: INK, leading: INDEX_LEADING })}
        </g>,
      );
      y += textHeight(lines.length, body, INDEX_LEADING) + body.size * 0.5;
    });
  }
  return <g>{items}</g>;
}

/** 出典の下に紙の下端の罫を引く。出典が無くても罫は引く。 */
function Citation(ctx: RenderCtx, rect: Rect, sources: Source[]): ReactNode {
  const t = ctx.skin.tokens;
  const f = t.font.citation;
  const text = '出典: ' + sources.map(formatSource).join('  ／  ');
  const lines = wrapLines(text, rect.width, ctx.measure, f).slice(0, 2);
  return (
    <g>
      {sources.length > 0 && Text({ x: rect.x, y: rect.y, lines, font: f, fill: INK_SOFT, letterSpacing: f.size * CITATION_TRACKING })}
      {rule('page-bottom', rect.x, rect.x + rect.width, rect.y + rect.height + 4)}
    </g>
  );
}

function formatSource(s: Source): string {
  const bits = [`${s.authors}（${s.year}）`, s.venue, s.arxiv ? `arXiv:${s.arxiv}` : s.doi ? `doi:${s.doi}` : undefined].filter(Boolean);
  return bits.join(' ');
}

export const editorialSkin: Skin = {
  id: 'editorial',
  name: '誌面',
  tokens: editorialTokens,
  fonts: [
    { family: MINCHO, googleId: 'Shippori+Mincho+B1', weights: [700] },
    { family: GOTHIC, googleId: 'Zen+Kaku+Gothic+New', weights: [500, 700] },
  ],
  Defs,
  Background,
  Title,
  Lane: LaneRule,
  Group,
  Node,
  Edge,
  Particle,
  Badge,
  CaptionStrip,
  Citation,
};
