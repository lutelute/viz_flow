import type { ReactNode } from 'react';
import type { DiagramEdge, DiagramGroup, DiagramNode, Lane, NodeKind, Payload, Source, ToneId } from '../../model/diagram';
import type { EdgeGeom, NodeBox, Pt, Rect, Size } from '../../layout/types';
import type { CompiledStep, NodeState, ParticleFrame, Phase } from '../../timeline/types';
import type { FontFace, RenderCtx, Skin, SkinTokens } from '../types';
import { NODE_GLYPHS, nodeGlyph } from '../icons';
import { Text, textHeight, wrapLines } from '../text';
import { formatSource } from '../sketch/skin';

// 整理したネオン。暗い無地にドット、背景に溶けた箱、アクセントは 3 色だけ。
// 発光は粒子のハロ 1 つに限り、グラデーション・ガラス・ぼかし・影は使わない。
// 配線の 2 色は背景とのコントラストが 3:1 を切らない値にしてある。

const BG = '#0F1218';
const BG2 = '#141922';
const INK = '#E8ECF2';
const INK_SOFT = '#9AA3B2';
const LINE = '#7C8798';
const LINE_SOFT = '#5A6475';
const DOT = '#1A1F28';
const FACE = '#171C25';
const FACE_MUTED = '#12161E';
const FRAME = '#2C3442';
const FRAME_SOFT = '#262D3A';
const LANE_LINE = '#232A36';

const tone: Record<ToneId, string> = {
  ink: INK,
  accent1: '#6FA8FF',
  accent2: '#FF7A90',
  accent3: '#7FD68A',
  ok: '#7FD68A',
  ng: '#FF7A90',
  warn: '#F5C26B',
  muted: '#5A6475',
};

const ALL_KINDS = Object.keys(NODE_GLYPHS) as NodeKind[];

const fill: Partial<Record<NodeKind, string>> = Object.fromEntries(ALL_KINDS.map((k) => [k, FACE]));

const DATA_KINDS: NodeKind[] = ['documents', 'chunker', 'vectordb', 'graphdb', 'index', 'memory'];
const MODEL_KINDS: NodeKind[] = ['embedding', 'encoder', 'llm', 'agent', 'policy'];
const CONTROL_KINDS: NodeKind[] = ['grader', 'router', 'reranker', 'retriever'];

function iconTone(kind: NodeKind): string {
  if (DATA_KINDS.includes(kind)) return tone.accent1;
  if (MODEL_KINDS.includes(kind)) return tone.accent3;
  if (CONTROL_KINDS.includes(kind)) return tone.accent2;
  return INK;
}

const UDP = 'BIZ UDPGothic';

const CORE_R = 5;
const HALO_R = 11;
const BADGE_R = 12;

export const neonTokens: SkinTokens = {
  bg: BG,
  bg2: BG2,
  ink: INK,
  inkSoft: INK_SOFT,
  line: LINE,
  lineSoft: LINE_SOFT,
  tone,
  fill,
  payloadTone: {
    text: 'ink', query: 'accent2', vector: 'accent1', chunks: 'accent1', prompt: 'accent2', answer: 'ok',
    image: 'accent3', graph: 'accent1', score: 'warn', plan: 'accent2', tokens: 'accent1', compressed: 'ink', generic: 'ink',
  },
  font: {
    title: { family: UDP, size: 32, weight: 700 },
    subtitle: { family: UDP, size: 16, weight: 400 },
    label: { family: UDP, size: 20, weight: 700 },
    sublabel: { family: UDP, size: 14, weight: 400 },
    edge: { family: UDP, size: 13, weight: 400 },
    badge: { family: UDP, size: 14, weight: 700 },
    caption: { family: UDP, size: 24, weight: 400 },
    particle: { family: UDP, size: 12, weight: 400 },
    lane: { family: UDP, size: 20, weight: 700 },
    citation: { family: UDP, size: 11, weight: 400 },
  },
  stroke: { node: 1, edge: 1.5, lane: 1.5, group: 1.5, icon: 1.75 },
  radius: { node: 10, lane: 14, corner: 8 },
  arrow: { kind: 'triangle', size: 8 },
  particle: { size: HALO_R * 2, labelGap: 4 },
  grid: { colWidth: 246, rowHeight: 180, laneGap: 64, padding: 48, laneHeader: 40 },
  nodeMin: { sm: { w: 130, h: 96 }, md: { w: 162, h: 112 }, lg: { w: 190, h: 124 } },
  nodePad: 12,
  iconSize: 40,
  stub: 14,
  track: 14,
  texture: 'dots',
  dark: true,
};

function glyphGroup(d: string[], x: number, y: number, size: number, color: string, width: number, key: string): ReactNode {
  const k = size / 24;
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${k})`} fill="none" stroke={color} strokeWidth={width / k} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => <path key={i} d={p} />)}
    </g>
  );
}

function Defs(): ReactNode {
  return (
    <pattern id="neon-dots" width={24} height={24} patternUnits="userSpaceOnUse">
      <circle cx={12} cy={12} r={1} fill={DOT} />
    </pattern>
  );
}

function Background(_ctx: RenderCtx, size: Size): ReactNode {
  return (
    <>
      <rect x={0} y={0} width={size.width} height={size.height} fill={BG} />
      <rect x={0} y={0} width={size.width} height={size.height} fill="url(#neon-dots)" />
    </>
  );
}

function Title(ctx: RenderCtx, rect: Rect, title: string, subtitle?: string): ReactNode {
  const t = ctx.skin.tokens;
  const h = t.font.title.size;
  return (
    <g>
      {Text({ x: rect.x, y: rect.y, lines: [title], font: t.font.title, fill: INK })}
      {subtitle && Text({ x: rect.x, y: rect.y + h * 1.45, lines: wrapLines(subtitle, rect.width, ctx.measure, t.font.subtitle), font: t.font.subtitle, fill: INK_SOFT })}
    </g>
  );
}

function LaneBand(ctx: RenderCtx, lane: Lane, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const frame = lane.frame ?? 'band';
  const parts: ReactNode[] = [];
  if (frame !== 'none') {
    parts.push(
      <rect key="band" x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={t.radius.lane} fill={frame === 'band' ? BG2 : 'none'} stroke={LANE_LINE} strokeWidth={t.stroke.lane} />,
    );
  }
  if (lane.label) {
    const size = t.font.lane.size;
    const lx = rect.x + 16;
    const ly = rect.y + 10;
    parts.push(
      <g key="label">
        <rect x={lx} y={ly + 1} width={4} height={size} rx={2} fill={lane.tone ? t.tone[lane.tone] : LINE} />
        {Text({ x: lx + 12, y: ly, lines: [lane.label], font: t.font.lane, fill: INK })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

function Group(ctx: RenderCtx, group: DiagramGroup, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const color = group.tone ? t.tone[group.tone] : LINE;
  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={12} fill="none" stroke={color} strokeWidth={t.stroke.group} strokeDasharray="6 5" />
      {group.label && Text({ x: rect.x + 12, y: rect.y - t.font.sublabel.size * 1.3, lines: [group.label], font: t.font.sublabel, fill: color })}
    </g>
  );
}

function Node(ctx: RenderCtx, node: DiagramNode, box: NodeBox, state: NodeState): ReactNode {
  const t = ctx.skin.tokens;
  const muted = node.emphasis === 'muted';
  const active = state.phase === 'active' || state.phase === 'processing';
  const face = muted ? FACE_MUTED : FACE;
  const strokeColor = active ? tone.accent2 : muted ? FRAME_SOFT : FRAME;
  const strokeW = active ? 1.8 : t.stroke.node;
  const scale = 1 + (state.pulse ?? 0) * 0.03;

  const iconSize = t.iconSize;
  const iconColor = muted ? tone.muted : iconTone(node.kind);
  const labelFont = t.font.label;
  const labelH = textHeight(box.labelLines.length, labelFont, 1.2);
  const subH = box.sublabelLines.length ? textHeight(box.sublabelLines.length, t.font.sublabel, 1.25) + 4 : 0;
  const contentH = iconSize + 8 + labelH + subH;
  const top = box.cy - contentH / 2;

  return (
    <g transform={`translate(${box.cx} ${box.cy}) scale(${scale}) translate(${-box.cx} ${-box.cy})`}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={t.radius.node} fill={face} stroke={strokeColor} strokeWidth={strokeW} />
      {node.emphasis === 'new' && (
        <path d={`M${box.x + 12} ${box.y} H${box.x + 40}`} fill="none" stroke={tone.accent2} strokeWidth={3} strokeLinecap="round" />
      )}
      {glyphGroup(nodeGlyph(node.kind, node.icon), box.cx - iconSize / 2, top, iconSize, iconColor, t.stroke.icon, `icon-${node.id}`)}
      {Text({ x: box.cx, y: top + iconSize + 8, lines: box.labelLines, font: labelFont, fill: muted ? INK_SOFT : INK, anchor: 'middle', leading: 1.2 })}
      {box.sublabelLines.length > 0 &&
        Text({ x: box.cx, y: top + iconSize + 8 + labelH + 4, lines: box.sublabelLines, font: t.font.sublabel, fill: INK_SOFT, anchor: 'middle', leading: 1.25 })}
      {state.phase === 'processing' && progressArc(box, state.progress ?? 0)}
      {state.phase === 'done' && <circle cx={box.x + box.w - 12} cy={box.y + 12} r={3.5} fill={tone.accent1} />}
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
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x} ${y}`} fill="none" stroke={tone.accent2} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function triangle(key: string, at: Pt, angleDeg: number, color: string, size: number): ReactNode {
  return (
    <path
      key={key}
      transform={`translate(${at.x} ${at.y}) rotate(${angleDeg})`}
      d={`M0 0 L${-size} ${-size * 0.5} L${-size} ${size * 0.5} Z`}
      fill={color}
    />
  );
}

function Edge(ctx: RenderCtx, edge: DiagramEdge, geom: EdgeGeom, phase: Phase): ReactNode {
  const t = ctx.skin.tokens;
  const role = edge.role ?? 'main';
  const base = edge.tone ? t.tone[edge.tone] : LINE;
  const color = phase === 'active' ? tone.accent2 : phase === 'pending' ? LINE_SOFT : base;
  const width = phase === 'active' ? 2 : t.stroke.edge;
  const dash = role === 'loop' || role === 'ref' || edge.line === 'dashed' ? '6 5' : edge.line === 'dotted' ? '2 5' : undefined;

  const parts: ReactNode[] = [
    <path key="line" d={geom.d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />,
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
        <rect x={b.x - 4} y={b.y - 2} width={b.width + 8} height={b.height + 4} fill={BG} />
        {Text({ x: geom.label.pos.x, y: b.y, lines: geom.label.lines, font: t.font.edge, fill: phase === 'active' ? INK : INK_SOFT, anchor: geom.label.anchor, leading: 1.25 })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

function core(key: string, x: number, color: string, ghost: boolean | undefined): ReactNode {
  return ghost
    ? <circle key={key} cx={x} r={CORE_R} fill={BG} stroke={color} strokeWidth={1.5} />
    : <circle key={key} cx={x} r={CORE_R} fill={color} />;
}

function Particle(ctx: RenderCtx, pf: ParticleFrame): ReactNode {
  const t = ctx.skin.tokens;

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

  const docked = pf.phase !== 'travel';
  const dx = docked ? -50 : 0;
  const dy = docked ? -34 : 0;
  if (docked) scale *= 0.75;

  const color = t.tone[shown.tone ?? t.payloadTone[shown.kind]];
  const stacked = shown.kind === 'chunks' && (shown.count ?? 1) >= 3;
  const label = pf.phase === 'travel' ? shown.label : undefined;
  const f = t.font.particle;
  const labelW = label ? ctx.measure.width(label, f.family, f.size, f.weight) : 0;
  const labelY = HALO_R + t.particle.labelGap;

  return (
    <g transform={`translate(${pf.x + dx} ${pf.y + dy}) scale(${scale})`}>
      {stacked
        ? <rect x={-HALO_R - 8} y={-HALO_R} width={HALO_R * 2 + 16} height={HALO_R * 2} rx={HALO_R} fill={color} opacity={0.3} />
        : <circle r={HALO_R} fill={color} opacity={0.3} />}
      {stacked
        ? [-8, 0, 8].map((x) => core(`c${x}`, x, color, shown.ghost))
        : core('c', 0, color, shown.ghost)}
      {label && (
        <g>
          <rect x={-labelW / 2 - 3} y={labelY - 1} width={labelW + 6} height={f.size + 2} fill={BG} />
          {Text({ x: 0, y: labelY, lines: [label], font: f, fill: color, anchor: 'middle' })}
        </g>
      )}
    </g>
  );
}

function badgeDisc(n: number, r: number, phase: Phase, font: FontFace): ReactNode {
  const face = phase === 'active' ? tone.accent2 : phase === 'done' ? tone.accent1 : FRAME_SOFT;
  const num = phase === 'pending' ? INK_SOFT : BG;
  return (
    <>
      <circle r={r} fill={face} stroke={phase === 'pending' ? LINE_SOFT : undefined} strokeWidth={1.5} />
      {Text({ x: 0, y: 0, lines: [String(n)], font, fill: num, anchor: 'middle', valign: 'middle' })}
    </>
  );
}

function Badge(ctx: RenderCtx, n: number, pos: Pt, phase: Phase, short?: string): ReactNode {
  const t = ctx.skin.tokens;
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}>
      {badgeDisc(n, BADGE_R, phase, t.font.badge)}
      {short && phase === 'active' && Text({ x: BADGE_R + 8, y: 0, lines: [short], font: t.font.edge, fill: tone.accent2, valign: 'middle' })}
    </g>
  );
}

function CaptionStrip(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], active: number): ReactNode {
  const t = ctx.skin.tokens;
  const f = t.font.caption;
  if (active < 0 || !steps[active]) return captionList(ctx, rect, steps);
  const st = steps[active];
  const lines = wrapLines(st.caption, rect.width - 52, ctx.measure, f).slice(0, 3);
  return (
    <g>
      {Badge(ctx, st.n, { x: rect.x + BADGE_R, y: rect.y + f.size * 0.6 }, 'active')}
      {Text({ x: rect.x + BADGE_R * 2 + 14, y: rect.y, lines, font: f, fill: INK, leading: 1.4 })}
      {Text({ x: rect.x + rect.width, y: rect.y + rect.height - t.font.sublabel.size, lines: [`${st.n} / ${steps.length}`], font: t.font.sublabel, fill: INK_SOFT, anchor: 'end' })}
    </g>
  );
}

function captionList(ctx: RenderCtx, rect: Rect, steps: CompiledStep[]): ReactNode {
  const t = ctx.skin.tokens;
  const small: FontFace = { ...t.font.caption, size: 17 };
  const digit: FontFace = { ...t.font.badge, size: 11 };
  const r = 9;
  const indent = r * 2 + 10;
  const leading = 1.35;
  const gap = 5;
  const cols = steps.length > 4 ? 2 : 1;
  const colW = rect.width / cols;
  const per = Math.ceil(steps.length / cols);
  const items: ReactNode[] = [];
  for (let c = 0; c < cols; c++) {
    const x = rect.x + c * colW;
    let y = rect.y;
    for (const s of steps.slice(c * per, (c + 1) * per)) {
      const lines = wrapLines(s.caption, colW - indent - 16, ctx.measure, small).slice(0, 2);
      items.push(
        <g key={s.index}>
          <g transform={`translate(${x + r} ${y + small.size * 0.55})`}>{badgeDisc(s.n, r, 'done', digit)}</g>
          {Text({ x: x + indent, y, lines, font: small, fill: INK, leading })}
        </g>,
      );
      y += textHeight(lines.length, small, leading) + gap;
    }
  }
  return <g>{items}</g>;
}

function Citation(ctx: RenderCtx, rect: Rect, sources: Source[]): ReactNode {
  const t = ctx.skin.tokens;
  if (sources.length === 0) return null;
  const text = '出典: ' + sources.map(formatSource).join(' ／ ');
  const lines = wrapLines(text, rect.width, ctx.measure, t.font.citation).slice(0, 2);
  return Text({ x: rect.x, y: rect.y, lines, font: t.font.citation, fill: INK_SOFT });
}

export const neonSkin: Skin = {
  id: 'neon',
  name: 'ネオン',
  tokens: neonTokens,
  fonts: [{ family: UDP, googleId: 'BIZ+UDPGothic', weights: [400, 700] }],
  Defs,
  Background,
  Title,
  Lane: LaneBand,
  Group,
  Node,
  Edge,
  Particle,
  Badge,
  CaptionStrip,
  Citation,
};
