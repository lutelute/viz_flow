import type { ReactNode } from 'react';
import type { Options } from 'roughjs/bin/core';
import type { DiagramEdge, DiagramGroup, DiagramNode, Lane, NodeKind, Payload, PayloadKind, Source, ToneId } from '../../model/diagram';
import type { EdgeGeom, NodeBox, Pt, Rect, Size } from '../../layout/types';
import type { CompiledStep, NodeState, ParticleFrame, Phase } from '../../timeline/types';
import type { RenderCtx, Skin, SkinTokens } from '../types';
import { nodeGlyph, payloadGlyph } from '../icons';
import { Text, textHeight, wrapLines } from '../text';
import { roughShape } from './rough-cache';

// 手描き・教科書風。紙色、太めの墨線、ずれた二重線、丸数字、蛍光ペンの下地。
// Excalidraw の真似に見えないように: roughness は低め、面は不透明パステル、
// アイコンは rough 化せず墨線で描く、題名にマーカー、ノードにわずかな傾き。

const PAPER = '#F5F0E6';
const PAPER2 = '#EEE7D8';
const INK = '#2A2724';
const INK_SOFT = '#6B645A';
const LINE = '#5C554B';
const LINE_SOFT = '#A89F90';
const MARKER = '#F7E6A1';

const tone: Record<ToneId, string> = {
  ink: INK,
  accent1: '#3B6FB6',
  accent2: '#D1603D',
  accent3: '#5B9A6B',
  ok: '#5B9A6B',
  ng: '#C8463A',
  warn: '#D9922E',
  muted: LINE_SOFT,
};

const PASTEL = {
  data: '#E6EDF6',
  model: '#E3EFE5',
  control: '#FAE8DC',
  io: '#FBF3D8',
  plain: '#F1EEE6',
};

const fill: Partial<Record<NodeKind, string>> = {
  documents: PASTEL.data, chunker: PASTEL.data, vectordb: PASTEL.data, graphdb: PASTEL.data, index: PASTEL.data, memory: PASTEL.data,
  embedding: PASTEL.model, encoder: PASTEL.model, llm: PASTEL.model, agent: PASTEL.model, policy: PASTEL.model,
  grader: PASTEL.control, router: PASTEL.control, reranker: PASTEL.control, retriever: PASTEL.control,
  user: PASTEL.io, query: PASTEL.io, answer: PASTEL.io, prompt: PASTEL.io, web: PASTEL.io, tool: PASTEL.io,
  generic: PASTEL.plain,
};

const KLEE = 'Klee One';
const KURENAIDO = 'Zen Kurenaido';

export const sketchTokens: SkinTokens = {
  bg: PAPER,
  bg2: PAPER2,
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
    title: { family: KLEE, size: 44, weight: 600 },
    subtitle: { family: KURENAIDO, size: 21, weight: 400 },
    label: { family: KLEE, size: 22, weight: 600 },
    sublabel: { family: KURENAIDO, size: 15, weight: 400 },
    edge: { family: KURENAIDO, size: 16, weight: 400 },
    badge: { family: KLEE, size: 17, weight: 600 },
    caption: { family: KURENAIDO, size: 27, weight: 400 },
    particle: { family: KURENAIDO, size: 14, weight: 400 },
    lane: { family: KLEE, size: 21, weight: 600 },
    citation: { family: KURENAIDO, size: 16, weight: 400 },
  },
  stroke: { node: 2.2, edge: 2.1, lane: 1.6, group: 1.4, icon: 2.2 },
  radius: { node: 10, lane: 14, corner: 10 },
  arrow: { kind: 'chevron-open', size: 13 },
  particle: { size: 30, labelGap: 6 },
  grid: { colWidth: 246, rowHeight: 180, laneGap: 64, padding: 48, laneHeader: 40 },
  nodeMin: { sm: { w: 130, h: 96 }, md: { w: 162, h: 112 }, lg: { w: 190, h: 124 } },
  nodePad: 12,
  iconSize: 40,
  stub: 14,
  track: 14,
  texture: 'paper',
  dark: false,
};

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M${x + rr} ${y}`,
    `H${x + w - rr}`,
    `Q${x + w} ${y} ${x + w} ${y + rr}`,
    `V${y + h - rr}`,
    `Q${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H${x + rr}`,
    `Q${x} ${y + h} ${x} ${y + h - rr}`,
    `V${y + rr}`,
    `Q${x} ${y} ${x + rr} ${y}`,
    'Z',
  ].join(' ');
}

function paths(infos: ReturnType<typeof roughShape>, key: string, extra?: { dash?: string; opacity?: number }): ReactNode {
  return infos.map((p, i) => (
    <path
      key={`${key}-${i}`}
      d={p.d}
      fill={p.fill}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={p.fill === 'none' ? extra?.dash : undefined}
      opacity={extra?.opacity}
    />
  ));
}

/** 蛍光ペンの下地。わずかに傾いた不透明の太線。 */
function marker(ctx: RenderCtx, key: string, x: number, y: number, w: number, h: number, color: string): ReactNode {
  const s = ctx.seed(key);
  const tilt = ((s % 7) - 3) * 0.25;
  const infos = roughShape(`marker:${key}:${Math.round(w)}x${Math.round(h)}`, s, (g, o) =>
    g.rectangle(x, y, w, h, { ...o, fill: color, stroke: 'none', roughness: 1.2, fillStyle: 'solid' }),
  );
  return <g transform={`rotate(${tilt} ${x + w / 2} ${y + h / 2})`}>{paths(infos, `mk-${key}`)}</g>;
}

function glyphGroup(d: string[], x: number, y: number, size: number, color: string, width: number, key: string, dash?: string): ReactNode {
  const k = size / 24;
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${k})`} fill="none" stroke={color} strokeWidth={width / k} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash ? dash : undefined}>
      {d.map((p, i) => <path key={i} d={p} />)}
    </g>
  );
}

function Defs(ctx: RenderCtx): ReactNode {
  const t = ctx.skin.tokens;
  const kinds = Object.keys(t.payloadTone) as PayloadKind[];
  const symbols: ReactNode[] = [];
  for (const kind of kinds) {
    for (const ghost of [false, true]) {
      const id = `pl-sketch-${kind}${ghost ? '-ghost' : ''}`;
      const color = t.tone[t.payloadTone[kind]];
      symbols.push(
        <symbol key={id} id={id} overflow="visible">
          <circle r={14} fill={PAPER} stroke={color} strokeWidth={2} strokeDasharray={ghost ? '4 3' : undefined} />
          {glyphGroup(payloadGlyph(kind), -9, -9, 18, color, 2, `g-${id}`, ghost ? '3 2' : undefined)}
        </symbol>,
      );
    }
  }
  return (
    <>
      <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={7} result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.30  0 0 0 0 0.22  0 0 0 0.09 0" />
      </filter>
      {symbols}
    </>
  );
}

function Background(_ctx: RenderCtx, size: Size): ReactNode {
  return (
    <>
      <rect x={0} y={0} width={size.width} height={size.height} fill={PAPER} />
      <rect x={0} y={0} width={size.width} height={size.height} filter="url(#paper-grain)" />
    </>
  );
}

function Title(ctx: RenderCtx, rect: Rect, title: string, subtitle?: string): ReactNode {
  const t = ctx.skin.tokens;
  const tw = ctx.measure.width(title, t.font.title.family, t.font.title.size, t.font.title.weight);
  const x = rect.x;
  const y = rect.y;
  const h = t.font.title.size;
  return (
    <g>
      {marker(ctx, 'title', x - 6, y + h * 0.35, tw + 12, h * 0.6, MARKER)}
      {Text({ x, y, lines: [title], font: t.font.title, fill: INK })}
      {subtitle && Text({ x, y: y + h * 1.3, lines: wrapLines(subtitle, rect.width, ctx.measure, t.font.subtitle), font: t.font.subtitle, fill: INK_SOFT })}
    </g>
  );
}

function LaneBand(ctx: RenderCtx, lane: Lane, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const s = ctx.seed(`lane:${lane.id}`);
  const frame = lane.frame ?? 'band';
  const parts: ReactNode[] = [];
  if (frame !== 'none') {
    const infos = roughShape(`lane:${lane.id}:${Math.round(rect.width)}x${Math.round(rect.height)}`, s, (g, o) =>
      g.path(roundedRectPath(rect.x, rect.y, rect.width, rect.height, t.radius.lane), {
        ...o,
        fill: frame === 'band' ? PAPER2 : 'none',
        stroke: LINE_SOFT,
        strokeWidth: t.stroke.lane,
        roughness: 0.9,
      }),
    );
    parts.push(<g key="band">{paths(infos, `lane-${lane.id}`)}</g>);
  }
  if (lane.label) {
    const color = lane.tone ? t.tone[lane.tone] : INK;
    const lw = ctx.measure.width(lane.label, t.font.lane.family, t.font.lane.size, t.font.lane.weight);
    const lx = rect.x + 18;
    const ly = rect.y + 10;
    parts.push(
      <g key="label">
        {marker(ctx, `lane-label:${lane.id}`, lx - 4, ly + t.font.lane.size * 0.4, lw + 8, t.font.lane.size * 0.55, mixPastel(color))}
        {Text({ x: lx, y: ly, lines: [lane.label], font: t.font.lane, fill: INK })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

/** アクセント色を紙に溶かしたパステル（不透明 hex）。 */
function mixPastel(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number, p: number) => Math.round(c * 0.35 + p * 0.65);
  const pr = 0xf5, pg = 0xf0, pb = 0xe6;
  return `#${[mix(r, pr), mix(g, pg), mix(b, pb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function Group(ctx: RenderCtx, group: DiagramGroup, rect: Rect): ReactNode {
  const t = ctx.skin.tokens;
  const s = ctx.seed(`group:${group.id}`);
  const color = group.tone ? t.tone[group.tone] : LINE;
  const infos = roughShape(`group:${group.id}:${Math.round(rect.width)}x${Math.round(rect.height)}`, s, (g, o) =>
    g.path(roundedRectPath(rect.x, rect.y, rect.width, rect.height, 12), { ...o, fill: 'none', stroke: color, strokeWidth: t.stroke.group, roughness: 0.8 }),
  );
  return (
    <g>
      {paths(infos, `grp-${group.id}`, { dash: '9 7' })}
      {group.label && Text({ x: rect.x + 12, y: rect.y - t.font.sublabel.size * 1.3, lines: [group.label], font: { ...t.font.sublabel, weight: 400 }, fill: color })}
    </g>
  );
}

function Node(ctx: RenderCtx, node: DiagramNode, box: NodeBox, state: NodeState): ReactNode {
  const t = ctx.skin.tokens;
  const s = ctx.seed(`node:${node.id}`);
  const muted = node.emphasis === 'muted';
  const face = muted ? PASTEL.plain : (fill[node.kind] ?? PASTEL.plain);
  const active = state.phase === 'active' || state.phase === 'processing';
  const strokeColor = active ? tone.accent2 : muted ? LINE_SOFT : INK;
  const strokeW = active ? t.stroke.node + 0.8 : t.stroke.node;
  const tilt = ((s % 5) - 2) * 0.5;
  const pulse = state.pulse ?? 0;
  const scale = 1 + pulse * 0.04;

  const body = roughShape(`node:${node.id}:${Math.round(box.w)}x${Math.round(box.h)}`, s, (g, o) =>
    g.path(roundedRectPath(box.x, box.y, box.w, box.h, t.radius.node), { ...o, fill: face, stroke: strokeColor, strokeWidth: strokeW }),
  );
  const ghostLine = roughShape(`node2:${node.id}:${Math.round(box.w)}x${Math.round(box.h)}`, s + 11, (g, o) =>
    g.path(roundedRectPath(box.x + 2, box.y + 2.5, box.w, box.h, t.radius.node), { ...o, fill: 'none', stroke: LINE_SOFT, strokeWidth: 1.1, roughness: 0.9 }),
  );

  const iconSize = t.iconSize;
  const iconColor = muted ? LINE_SOFT : INK;
  const labelFont = t.font.label;
  const labelH = textHeight(box.labelLines.length, labelFont, 1.2);
  const subH = box.sublabelLines.length ? textHeight(box.sublabelLines.length, t.font.sublabel, 1.25) + 4 : 0;
  const contentH = iconSize + 8 + labelH + subH;
  const top = box.cy - contentH / 2;

  const newMark = node.emphasis === 'new'
    ? marker(ctx, `new:${node.id}`, box.x - 4, box.y - 10, 44, 10, mixPastel(tone.accent2))
    : null;

  return (
    <g transform={`rotate(${tilt} ${box.cx} ${box.cy}) translate(${box.cx} ${box.cy}) scale(${scale}) translate(${-box.cx} ${-box.cy})`}>
      {paths(ghostLine, `n2-${node.id}`)}
      {paths(body, `n-${node.id}`)}
      {newMark}
      {glyphGroup(nodeGlyph(node.kind, node.icon), box.cx - iconSize / 2, top, iconSize, iconColor, t.stroke.icon, `icon-${node.id}`)}
      {Text({ x: box.cx, y: top + iconSize + 8, lines: box.labelLines, font: labelFont, fill: muted ? INK_SOFT : INK, anchor: 'middle', leading: 1.2 })}
      {box.sublabelLines.length > 0 &&
        Text({ x: box.cx, y: top + iconSize + 8 + labelH + 4, lines: box.sublabelLines, font: t.font.sublabel, fill: INK_SOFT, anchor: 'middle', leading: 1.25 })}
      {state.phase === 'processing' && progressArc(box, state.progress ?? 0)}
      {state.phase === 'done' && doneTick(box)}
    </g>
  );
}

function progressArc(box: NodeBox, p: number): ReactNode {
  const r = 9;
  const cx = box.x + box.w - 14;
  const cy = box.y + 14;
  const a = Math.max(0.001, Math.min(0.999, p)) * Math.PI * 2;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = a > Math.PI ? 1 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={PAPER} stroke={LINE_SOFT} strokeWidth={1.4} />
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x} ${y}`} fill="none" stroke={tone.accent2} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

function doneTick(box: NodeBox): ReactNode {
  const x = box.x + box.w - 22;
  const y = box.y + 6;
  return <path d={`M${x} ${y + 8} l5 5 l9 -11`} fill="none" stroke={tone.accent3} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />;
}

function Edge(ctx: RenderCtx, edge: DiagramEdge, geom: EdgeGeom, phase: Phase): ReactNode {
  const t = ctx.skin.tokens;
  const s = ctx.seed(`edge:${edge.id}`);
  const role = edge.role ?? 'main';
  const base = edge.tone ? t.tone[edge.tone] : LINE;
  const color = phase === 'active' ? tone.accent2 : phase === 'pending' ? LINE_SOFT : base;
  const width = phase === 'active' ? t.stroke.edge + 0.7 : t.stroke.edge;
  const dash = role === 'loop' || role === 'ref' || edge.line === 'dashed' ? '9 7' : edge.line === 'dotted' ? '2 6' : undefined;
  const key = geom.points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join('|');

  const line = roughShape(`edge:${edge.id}:${key}`, s, (g, o) =>
    g.path(geom.d, { ...o, fill: 'none', stroke: color, strokeWidth: width, roughness: 0.6, bowing: 0.4 }),
  );

  const parts: ReactNode[] = [paths(line, `e-${edge.id}`, { dash })];

  if (edge.arrow !== 'none') {
    parts.push(chevron(ctx, `${edge.id}:end`, geom.arrowAt, geom.arrowAngle, color, width, t.arrow.size));
    if (edge.arrow === 'both') {
      const p0 = geom.points[0];
      const p1 = geom.points[1] ?? p0;
      const ang = (Math.atan2(p0.y - p1.y, p0.x - p1.x) * 180) / Math.PI;
      parts.push(chevron(ctx, `${edge.id}:start`, p0, ang, color, width, t.arrow.size));
    }
  }

  if (geom.label) {
    const f = t.font.edge;
    const b = geom.label.box;
    parts.push(
      <g key="label">
        <rect x={b.x - 4} y={b.y - 2} width={b.width + 8} height={b.height + 4} fill={PAPER} />
        {Text({ x: geom.label.pos.x, y: b.y, lines: geom.label.lines, font: f, fill: phase === 'pending' ? INK_SOFT : INK, anchor: geom.label.anchor, leading: 1.25 })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

/** 開いた山形の矢印。手描き線 2 本。 */
function chevron(ctx: RenderCtx, key: string, at: Pt, angleDeg: number, color: string, width: number, size: number): ReactNode {
  const s = ctx.seed(`arrow:${key}`);
  const infos = roughShape(`arrow:${key}:${Math.round(at.x)},${Math.round(at.y)},${Math.round(angleDeg)}`, s, (g, o) =>
    g.path(`M${-size} ${-size * 0.55} L0 0 L${-size} ${size * 0.55}`, { ...o, fill: 'none', stroke: color, strokeWidth: width, roughness: 0.5 }),
  );
  return <g key={key} transform={`translate(${at.x} ${at.y}) rotate(${angleDeg})`}>{paths(infos, `arr-${key}`)}</g>;
}

function Particle(ctx: RenderCtx, pf: ParticleFrame): ReactNode {
  const t = ctx.skin.tokens;
  const size = t.particle.size;
  const k = size / 32;
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
  const sym = `pl-sketch-${shown.kind}${shown.ghost ? '-ghost' : ''}`;
  // ノードの中にいる間はノードのラベルと重なるので、粒子のラベルは移動中だけ出す
  const label = pf.phase === 'travel' ? shown.label : undefined;
  const stacked = shown.kind === 'chunks' && (shown.count ?? 1) >= 3;

  return (
    <g transform={`translate(${pf.x + dx} ${pf.y + dy}) scale(${scale * k})`}>
      {stacked && <use href={`#${sym}`} transform="translate(5 -5)" />}
      <use href={`#${sym}`} />
      {label && scale > 0.6 && (
        <g transform={`scale(${1 / k})`}>
          <rect x={-ctx.measure.width(label, t.font.particle.family, t.font.particle.size, t.font.particle.weight) / 2 - 3} y={size / 2 + t.particle.labelGap - 2} width={ctx.measure.width(label, t.font.particle.family, t.font.particle.size, t.font.particle.weight) + 6} height={t.font.particle.size + 4} fill={PAPER} />
          {Text({ x: 0, y: size / 2 + t.particle.labelGap, lines: [label], font: t.font.particle, fill: color, anchor: 'middle' })}
        </g>
      )}
    </g>
  );
}

function Badge(ctx: RenderCtx, n: number, pos: Pt, phase: Phase, short?: string): ReactNode {
  const t = ctx.skin.tokens;
  const r = 15;
  const s = ctx.seed(`badge:${n}`);
  const faceFill = phase === 'active' ? tone.accent2 : phase === 'done' ? tone.accent1 : PAPER;
  const num = phase === 'pending' ? INK_SOFT : PAPER;
  const ring = phase === 'active'
    ? roughShape(`badge-ring:${n}`, s, (g, o) => g.circle(0, 0, r * 2 + 10, { ...o, fill: 'none', stroke: tone.accent2, strokeWidth: 1.6, roughness: 1.1 }))
    : null;
  return (
    <g transform={`translate(${pos.x} ${pos.y})`}>
      {ring && paths(ring, `ring-${n}`)}
      <circle r={r} fill={faceFill} stroke={phase === 'pending' ? LINE_SOFT : INK} strokeWidth={1.6} />
      {Text({ x: 0, y: 0, lines: [String(n)], font: t.font.badge, fill: num, anchor: 'middle', valign: 'middle' })}
      {short && phase === 'active' && Text({ x: r + 8, y: 0, lines: [short], font: { ...t.font.edge, weight: 400 }, fill: tone.accent2, valign: 'middle' })}
    </g>
  );
}

function CaptionStrip(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], active: number): ReactNode {
  const t = ctx.skin.tokens;
  const f = t.font.caption;
  if (active < 0 || !steps[active]) {
    const small = { ...f, size: Math.round(f.size * 0.72) };
    const lines = steps.map((s) => `${circled(s.n)} ${s.caption}`);
    const cols = lines.length > 4 ? 2 : 1;
    const colW = rect.width / cols;
    const per = Math.ceil(lines.length / cols);
    return (
      <g>
        {Array.from({ length: cols }, (_, c) =>
          Text({ x: rect.x + c * colW, y: rect.y, lines: lines.slice(c * per, (c + 1) * per).flatMap((l) => wrapLines(l, colW - 16, ctx.measure, small).slice(0, 2)), font: small, fill: INK, leading: 1.45 }),
        )}
      </g>
    );
  }
  const st = steps[active];
  const lines = wrapLines(st.caption, rect.width - 60, ctx.measure, f).slice(0, 3);
  return (
    <g>
      {Badge(ctx, st.n, { x: rect.x + 20, y: rect.y + f.size * 0.6 }, 'active')}
      {Text({ x: rect.x + 52, y: rect.y, lines, font: f, fill: INK, leading: 1.4 })}
      {Text({ x: rect.x + rect.width, y: rect.y + rect.height - t.font.sublabel.size, lines: [`${st.n} / ${steps.length}`], font: t.font.sublabel, fill: INK_SOFT, anchor: 'end' })}
    </g>
  );
}

function circled(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

function Citation(ctx: RenderCtx, rect: Rect, sources: Source[]): ReactNode {
  const t = ctx.skin.tokens;
  if (sources.length === 0) return null;
  const text = '出典: ' + sources.map(formatSource).join(' ／ ');
  const lines = wrapLines(text, rect.width, ctx.measure, t.font.citation).slice(0, 2);
  return Text({ x: rect.x, y: rect.y, lines, font: t.font.citation, fill: INK_SOFT });
}

export function formatSource(s: Source): string {
  const bits = [`${s.authors}（${s.year}）`, s.venue, s.arxiv ? `arXiv:${s.arxiv}` : s.doi ? `doi:${s.doi}` : undefined].filter(Boolean);
  return bits.join(' ');
}

export const sketchSkin: Skin = {
  id: 'sketch',
  name: '教科書',
  tokens: sketchTokens,
  fonts: [
    { family: KLEE, googleId: 'Klee+One', weights: [400, 600] },
    { family: KURENAIDO, googleId: 'Zen+Kurenaido', weights: [400] },
  ],
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

export type { Options };
