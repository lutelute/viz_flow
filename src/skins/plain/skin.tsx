import type { ReactNode } from 'react';
import type { DiagramEdge, DiagramGroup, DiagramNode, Lane, NodeKind, Payload, Source, ToneId } from '../../model/diagram';
import type { EdgeGeom, NodeBox, Pt, Rect, Size } from '../../layout/types';
import type { CompiledStep, NodeState, ParticleFrame, Phase } from '../../timeline/types';
import type { FontFace, RenderCtx, Skin, SkinTokens } from '../types';
import { NODE_GLYPHS, nodeGlyph } from '../icons';
import { Text, textHeight, wrapLines } from '../text';
import { formatSource } from '../sketch/skin';
import { labelBox } from '../../render/label-room';

// 略図。丸の中のアイコンと短い名前だけで部品を表し、細い線と小さな点で流れを見せる。
// 箱は描かない。色は墨と灰に、意味のある 3 色（藍・錆・緑）だけを足す。補足は描かない。
// 面はすべて不透明。グラデーション・ぼかし・発光・半透明は使わない。

/** 図の色の組。明るい版と、画面をダークにしたときの暗い版を同じ形で持つ。 */
interface Palette {
  paper: string;
  band: string;
  disc: string;
  discMuted: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineSoft: string;
  blue: string;
  rust: string;
  green: string;
}

// 字は地と帯の両方に 4.5:1、線は 3:1 を超える（WCAG 1.4.3 と 1.4.11）
const LIGHT: Palette = {
  paper: '#F8F8F6',
  band: '#EFF0EC',
  disc: '#E1E4E2',
  discMuted: '#EBEDEA',
  ink: '#25282B',
  inkSoft: '#676C70',
  line: '#848B8E',
  lineSoft: '#C4C9CB',
  blue: '#3C6E9F',
  rust: '#AB5137',
  green: '#407751',
};

// 画面のダーク（--ui-surface）に地を寄せ、丸・線・字は明るさの順を明るい版と逆にする。
// 3 色は暗い地で読めるよう明るくし、色相は明るい版と同じにする
const DARK: Palette = {
  paper: '#232528',
  band: '#2A2D31',
  disc: '#3A3F44',
  discMuted: '#30343A',
  ink: '#E8EAE8',
  inkSoft: '#A4AAAE',
  line: '#72797D',
  lineSoft: '#4A5056',
  blue: '#82AEDB',
  rust: '#E39275',
  green: '#7EC093',
};

function toneOf(p: Palette): Record<ToneId, string> {
  return { ink: p.ink, accent1: p.blue, accent2: p.rust, accent3: p.green, ok: p.green, ng: p.rust, warn: p.rust, muted: p.line };
}

const ALL_KINDS = Object.keys(NODE_GLYPHS) as NodeKind[];

const FONT = 'Zen Maru Gothic';

/**
 * どのノードも同じ大きさの箱に入れる。丸は箱の中心、名前は丸の下。
 * 箱の大きさが一定なので、辺の端から丸までの距離も一定になり、線を丸まで伸ばせる。
 * 名前 2 行までがこの箱に収まる。
 */
const NODE_W = 152;
const NODE_H = 146;
const DISC_R = 25;
const GLYPH = 26;
const LABEL_GAP = 6;
const LABEL_LEADING = 1.25;
const ARROW = 9;
const ARROW_GAP = 3;
/** 箱の左右・上の辺（ポート）から丸の手前までの距離 */
const REACH_X = NODE_W / 2 - DISC_R - ARROW_GAP;
const REACH_Y = NODE_H / 2 - DISC_R - ARROW_GAP;
/** 「足された要素」の輪と、処理中の進み具合の輪は同じ半径に描く。名前に掛からない大きさ */
const RING_GAP = 4.5;
const PARTICLE_R = 7;
const BADGE_R = 13;
const EDGE_W = 2;
const EDGE_W_ACTIVE = 3;
const EDGE_LEADING = 1.3;

function tokensOf(p: Palette, dark: boolean): SkinTokens {
  return {
    bg: p.paper,
    bg2: p.band,
    ink: p.ink,
    inkSoft: p.inkSoft,
    line: p.line,
    lineSoft: p.lineSoft,
    tone: toneOf(p),
    fill: Object.fromEntries(ALL_KINDS.map((k) => [k, p.disc])),
    payloadTone: {
      text: 'ink', query: 'accent2', vector: 'accent1', chunks: 'accent1', prompt: 'accent2', answer: 'ok',
      image: 'accent1', graph: 'accent1', score: 'warn', plan: 'accent2', tokens: 'accent1', compressed: 'ink', generic: 'ink',
    },
    font: {
      title: { family: FONT, size: 36, weight: 700 },
      subtitle: { family: FONT, size: 17, weight: 500 },
      label: { family: FONT, size: 17, weight: 700 },
      sublabel: { family: FONT, size: 13, weight: 500 },
      edge: { family: FONT, size: 14, weight: 700 },
      badge: { family: FONT, size: 15, weight: 700 },
      caption: { family: FONT, size: 24, weight: 500 },
      particle: { family: FONT, size: 13, weight: 700 },
      lane: { family: FONT, size: 15, weight: 700 },
      citation: { family: FONT, size: 12, weight: 500 },
    },
    stroke: { node: 0, edge: EDGE_W, lane: 0, group: 2, icon: 2 },
    radius: { node: DISC_R, lane: 18, corner: 16 },
    arrow: { kind: 'triangle-small', size: ARROW },
    particle: { size: PARTICLE_R * 2, labelGap: 5 },
    grid: { colWidth: 246, rowHeight: 194, laneGap: 44, padding: 48, laneHeader: 26 },
    nodeMin: { sm: { w: NODE_W, h: NODE_H }, md: { w: NODE_W, h: NODE_H }, lg: { w: NODE_W, h: NODE_H } },
    nodePad: 4,
    // レイアウトの高さ計算に使うだけ。実際の丸の直径は DISC_R * 2
    iconSize: 52,
    stub: 12,
    track: 12,
    texture: 'none',
    dark,
    showSublabel: false,
    disc: DISC_R,
  };
}

/** 画面がダークのときは暗い版の色を使う */
function paletteOf(ctx: RenderCtx): Palette {
  return ctx.skin.tokens.dark ? DARK : LIGHT;
}

function glyphGroup(d: string[], cx: number, cy: number, size: number, color: string, width: number, key: string): ReactNode {
  const k = size / 24;
  return (
    <g key={key} transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`} fill="none" stroke={color} strokeWidth={width / k} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => <path key={i} d={p} />)}
    </g>
  );
}

function Defs(): ReactNode {
  return null;
}

function Background(ctx: RenderCtx, size: Size): ReactNode {
  const pal = paletteOf(ctx);
  return <rect x={0} y={0} width={size.width} height={size.height} fill={pal.paper} />;
}

function Title(ctx: RenderCtx, rect: Rect, title: string, subtitle?: string): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const titleLines = wrapLines(title, rect.width, ctx.measure, t.font.title).slice(0, 2);
  const titleH = textHeight(titleLines.length, t.font.title, 1.2);
  const subLines = subtitle ? wrapLines(subtitle, rect.width, ctx.measure, t.font.subtitle).slice(0, 2) : [];
  return (
    <g>
      {Text({ x: rect.x, y: rect.y, lines: titleLines, font: t.font.title, fill: pal.ink, leading: 1.2 })}
      {subLines.length > 0 && Text({ x: rect.x, y: rect.y + titleH + 12, lines: subLines, font: t.font.subtitle, fill: pal.inkSoft, leading: 1.45 })}
    </g>
  );
}

function LaneBand(ctx: RenderCtx, lane: Lane, rect: Rect): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const frame = lane.frame ?? 'band';
  const parts: ReactNode[] = [];
  if (frame === 'band') {
    parts.push(<rect key="band" x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={t.radius.lane} fill={pal.band} />);
  } else if (frame === 'outline') {
    parts.push(
      <rect key="outline" x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={t.radius.lane} fill="none" stroke={pal.lineSoft} strokeWidth={2} strokeDasharray="6 6" />,
    );
  }
  if (lane.label) {
    const f = t.font.lane;
    const x = rect.x + 18;
    const y = rect.y + 12;
    parts.push(
      <g key="label">
        <circle cx={x + 4} cy={y + f.size * 0.52} r={4.5} fill={lane.tone ? t.tone[lane.tone] : pal.line} />
        {Text({ x: x + 16, y, lines: [lane.label], font: f, fill: pal.inkSoft })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

function Group(ctx: RenderCtx, group: DiagramGroup, rect: Rect): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const color = group.tone ? t.tone[group.tone] : pal.line;
  const f = t.font.sublabel;
  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={16} fill="none" stroke={color} strokeWidth={t.stroke.group} strokeDasharray="6 6" />
      {group.label && Text({ x: rect.x + 14, y: rect.y - f.size * 1.35, lines: [group.label], font: { ...f, weight: 700 }, fill: color })}
    </g>
  );
}

/** 名前が箱の下端からはみ出すときだけ、字を小さくして収める。 */
function fitLabel(font: FontFace, lines: number, room: number): FontFace {
  const h = textHeight(lines, font, LABEL_LEADING);
  if (h <= room || lines === 0) return font;
  return { ...font, size: Math.max(11, (font.size * room) / h) };
}

function Node(ctx: RenderCtx, node: DiagramNode, box: NodeBox, state: NodeState): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const port = node.kind === 'port';
  const muted = node.emphasis === 'muted' && !port;
  const isNew = node.emphasis === 'new';
  const active = state.phase === 'active' || state.phase === 'processing';
  const { cx, cy } = box;
  const scale = 1 + (state.pulse ?? 0) * 0.04;

  const labelTop = cy + DISC_R + LABEL_GAP;
  const font = fitLabel(t.font.label, box.labelLines.length, box.y + box.h - 3 - labelTop);
  const glyph = nodeGlyph(node.kind, node.icon);

  const parts: ReactNode[] = [];
  if (port) {
    // 外の図との境目。部品ではなく端子に見えるよう、中を抜いた破線の丸にする
    parts.push(
      <circle key="disc" cx={cx} cy={cy} r={DISC_R} fill={pal.paper} stroke={active ? pal.ink : pal.line} strokeWidth={2} strokeDasharray="5 4" />,
      glyphGroup(glyph, cx, cy, GLYPH - 4, active ? pal.ink : pal.inkSoft, t.stroke.icon, 'icon'),
    );
  } else {
    const face = active ? pal.ink : muted ? pal.discMuted : pal.disc;
    const iconColor = active ? pal.paper : muted ? pal.inkSoft : pal.ink;
    parts.push(
      <circle key="disc" cx={cx} cy={cy} r={DISC_R} fill={face} />,
      glyphGroup(glyph, cx, cy, GLYPH, iconColor, t.stroke.icon, 'icon'),
    );
  }
  if (isNew) {
    parts.push(<circle key="new" cx={cx} cy={cy} r={DISC_R + RING_GAP} fill="none" stroke={pal.rust} strokeWidth={2.5} />);
  }
  if (state.phase === 'processing') {
    parts.push(progressArc(pal, cx, cy, DISC_R + RING_GAP, state.progress ?? 0, !isNew));
  }

  return (
    <g>
      <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>{parts}</g>
      {Text({ x: cx, y: labelTop, lines: box.labelLines, font, fill: muted || port ? pal.inkSoft : pal.ink, anchor: 'middle', leading: LABEL_LEADING })}
    </g>
  );
}

/** track が false なら下地の輪を描かない（足された要素の錆色の輪が下地になる） */
function progressArc(pal: Palette, cx: number, cy: number, r: number, p: number, track: boolean): ReactNode {
  const a = Math.max(0.001, Math.min(0.999, p)) * Math.PI * 2;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = a > Math.PI ? 1 : 0;
  return (
    <g key="progress">
      {track && <circle cx={cx} cy={cy} r={r} fill="none" stroke={pal.lineSoft} strokeWidth={2.5} />}
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x} ${y}`} fill="none" stroke={pal.ink} strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

interface Dir { x: number; y: number }

function unit(a: Pt, b: Pt): Dir {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

/** 下のポートは名前の下にあるので伸ばさない。それ以外は丸の手前まで伸ばす。 */
function reachInto(port: Pt, inward: Dir): Pt {
  const vertical = Math.abs(inward.y) > 0.5;
  const fromBelow = inward.y < -0.5;
  const k = fromBelow ? 0 : vertical ? REACH_Y : REACH_X;
  return { x: port.x + inward.x * k, y: port.y + inward.y * k };
}

function num(v: number): string {
  return String(Math.round(v * 10) / 10);
}

function arrowHead(key: string, at: Pt, dir: Dir, color: string, size: number): ReactNode {
  const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const half = size * 0.5;
  return (
    <path
      key={key}
      d={`M0 0 L${-size} ${-half} L${-size} ${half} Z`}
      fill={color}
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      transform={`translate(${num(at.x)} ${num(at.y)}) rotate(${num(deg)})`}
    />
  );
}

function Edge(ctx: RenderCtx, edge: DiagramEdge, geom: EdgeGeom, phase: Phase): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const pts = geom.points;
  if (pts.length < 2) return null;
  const role = edge.role ?? 'main';
  const active = phase === 'active';
  const toned = edge.tone ? t.tone[edge.tone] : undefined;
  const color = toned ?? (active ? pal.ink : pal.line);
  const width = active ? EDGE_W_ACTIVE : EDGE_W;
  const dash = role === 'loop' || role === 'ref' || edge.line === 'dashed' ? '7 6' : edge.line === 'dotted' ? '0.5 6' : undefined;
  const size = active ? ARROW + 1 : ARROW;

  // 端を箱の辺から丸の手前まで伸ばす。丸は線より上に描くので、多少入り込んでも隠れる
  // どちらも「線の側からノードの中へ」向かう向き
  const intoFrom = unit(pts[1], pts[0]);
  const intoTo = unit(pts[pts.length - 2], pts[pts.length - 1]);
  const start = reachInto(pts[0], intoFrom);
  const end = reachInto(pts[pts.length - 1], intoTo);
  const headEnd = edge.arrow !== 'none';
  const headStart = edge.arrow === 'both';
  // 線の端が矢じりの先から突き出ないよう、矢じりの根元で止める
  const back = size * 0.6;
  const lineEnd = headEnd ? { x: end.x - intoTo.x * back, y: end.y - intoTo.y * back } : end;
  const lineStart = headStart ? { x: start.x - intoFrom.x * back, y: start.y - intoFrom.y * back } : start;
  const d = `M ${num(lineStart.x)} ${num(lineStart.y)} ${geom.d.replace(/^M/, 'L')} L ${num(lineEnd.x)} ${num(lineEnd.y)}`;

  const parts: ReactNode[] = [
    <path key="line" d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />,
  ];
  if (headEnd) parts.push(arrowHead('end', end, intoTo, color, size));
  if (headStart) parts.push(arrowHead('start', start, intoFrom, color, size));

  if (geom.label) {
    const f = t.font.edge;
    const b = geom.label.box;
    // 字の位置は box から決める。レイアウトの重なり判定は box で行われているため
    const anchor = geom.label.anchor;
    const tx = anchor === 'start' ? b.x : anchor === 'end' ? b.x + b.width : b.x + b.width / 2;
    // box は行送り込みの高さなので、字は縦の中央に置き、地の札は字に合わせる
    const th = textHeight(geom.label.lines.length, f, EDGE_LEADING);
    const ty = b.y + (b.height - th) / 2;
    parts.push(
      <g key="label">
        <rect x={b.x - 5} y={ty - 4} width={b.width + 10} height={th + 8} rx={6} fill={pal.paper} />
        {Text({ x: tx, y: ty, lines: geom.label.lines, font: f, fill: toned ?? (active ? pal.ink : pal.inkSoft), anchor, leading: EDGE_LEADING })}
      </g>,
    );
  }
  return <g>{parts}</g>;
}

function dot(pal: Palette, key: string, x: number, y: number, r: number, color: string, ghost: boolean | undefined): ReactNode {
  return ghost
    ? <circle key={key} cx={x} cy={y} r={r} fill={pal.paper} stroke={color} strokeWidth={2} strokeDasharray="3 2.5" />
    : <circle key={key} cx={x} cy={y} r={r} fill={color} stroke={pal.paper} strokeWidth={2} />;
}

/** 文書 3 件以上は小さな点を 3 つ寄せて描く */
const CLUSTER: Array<[number, number]> = [[-5.5, 3.5], [5.5, 3.5], [0, -5.5]];

function Particle(ctx: RenderCtx, pf: ParticleFrame): ReactNode {
  const pal = paletteOf(ctx);
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

  // ノードにいる間は丸の左肩に載せる。名前とは重ならない
  const docked = pf.phase !== 'travel';
  const off = DISC_R * 0.8;
  const x = docked ? pf.x - off : pf.x;
  const y = docked ? pf.y - off : pf.y;
  if (docked) scale *= 0.85;

  const color = t.tone[shown.tone ?? t.payloadTone[shown.kind]];
  const stacked = shown.kind === 'chunks' && (shown.count ?? 1) >= 3;
  const f = t.font.particle;
  let label = pf.phase === 'travel' ? shown.label : undefined;
  const labelW = label ? ctx.measure.width(label, f.family, f.size, f.weight) : 0;
  // 字の札の大きさと、粒子の中心から札の近い辺までの距離
  const plateW = labelW + 8;
  const plateH = f.size + 5;
  const gap = PARTICLE_R + t.particle.labelGap;
  // 札の位置。粒子の中心からの相対。下調べが無い（並べて描く図など）ときは線の下の中央
  let plate = { x: -plateW / 2, y: gap };
  const room = ctx.labelRoom;
  if (label && room && pf.edge) {
    // 辺ごとに決めた側に出し、そこでも番号やラベルに掛かる間だけ字を伏せる
    const side = room.side(pf.edge, plateW, plateH, gap);
    const box = labelBox({ x, y }, pf.heading, plateW, plateH, gap, side);
    if (room.blocked(box)) label = undefined;
    plate = { x: box.x - x, y: box.y - y };
  }

  return (
    <g transform={`translate(${num(x)} ${num(y)}) scale(${scale.toFixed(3)})`}>
      {stacked
        ? CLUSTER.map(([cx, cy], i) => dot(pal, `c${i}`, cx, cy, 5.5, color, shown.ghost))
        : dot(pal, 'c', 0, 0, PARTICLE_R, color, shown.ghost)}
      {label && scale > 0.6 && (
        <g transform={`scale(${(1 / scale).toFixed(3)})`}>
          <rect x={plate.x} y={plate.y} width={plateW} height={plateH} rx={5} fill={pal.paper} />
          {Text({ x: plate.x + plateW / 2, y: plate.y + 2, lines: [label], font: f, fill: color, anchor: 'middle' })}
        </g>
      )}
    </g>
  );
}

function badgeDisc(pal: Palette, n: number, r: number, phase: Phase, font: FontFace): ReactNode {
  const face = phase === 'active' ? pal.ink : pal.paper;
  const ring = phase === 'pending' ? pal.lineSoft : pal.ink;
  const digit = phase === 'active' ? pal.paper : phase === 'pending' ? pal.inkSoft : pal.ink;
  return (
    <>
      <circle r={r} fill={face} stroke={ring} strokeWidth={2} />
      {Text({ x: 0, y: 0.5, lines: [String(n)], font, fill: digit, anchor: 'middle', valign: 'middle' })}
    </>
  );
}

/**
 * 番号だけを描き、横の短い語（short）は出さない。
 * 短い語は辺のラベルと同じ語になりやすく、バッジが縦の線の左にあると線をまたいでラベルに重なる。
 * 同じ文は字幕の帯と手順の一覧に出る。
 */
function Badge(ctx: RenderCtx, n: number, pos: Pt, phase: Phase): ReactNode {
  const pal = paletteOf(ctx);
  return <g transform={`translate(${num(pos.x)} ${num(pos.y)})`}>{badgeDisc(pal, n, BADGE_R, phase, ctx.skin.tokens.font.badge)}</g>;
}

function CaptionStrip(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], active: number): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const f = t.font.caption;
  if (active < 0 || !steps[active]) return captionIndex(ctx, rect, steps);
  const st = steps[active];
  const indent = BADGE_R * 2 + 16;
  const lines = wrapLines(st.caption, rect.width - indent, ctx.measure, f).slice(0, 3);
  return (
    <g>
      <g transform={`translate(${rect.x + BADGE_R} ${rect.y + f.size * 0.55})`}>{badgeDisc(pal, st.n, BADGE_R, 'active', t.font.badge)}</g>
      {Text({ x: rect.x + indent, y: rect.y, lines, font: f, fill: pal.ink, leading: 1.45 })}
      {Text({ x: rect.x + rect.width, y: rect.y + rect.height - t.font.citation.size, lines: [`${st.n} / ${steps.length}`], font: t.font.citation, fill: pal.inkSoft, anchor: 'end' })}
    </g>
  );
}

const INDEX_SIZES = [18, 17, 16, 15, 14, 13];
const INDEX_GUTTER = 28;
const INDEX_LEADING = 1.4;

interface IndexPlan { size: number; cols: number; colW: number; lines: string[][] }

/** 字の大きさと段数を順に試し、帯の高さに収まる最初の組み合わせを選ぶ。 */
function planIndex(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], indent: number): IndexPlan {
  const base = ctx.skin.tokens.font.caption;
  const colChoices = steps.length > 4 ? [2, 3] : [1, 2];
  let fallback: IndexPlan | null = null;
  for (const size of INDEX_SIZES) {
    for (const cols of colChoices) {
      const colW = (rect.width - INDEX_GUTTER * (cols - 1)) / cols;
      const font = { ...base, size };
      const lines = steps.map((s) => wrapLines(s.caption, colW - indent, ctx.measure, font));
      const per = Math.ceil(steps.length / cols);
      let height = 0;
      for (let c = 0; c < cols; c++) {
        const col = lines.slice(c * per, (c + 1) * per);
        height = Math.max(height, col.reduce((acc, l) => acc + textHeight(l.length, font, INDEX_LEADING) + size * 0.45, 0));
      }
      const plan = { size, cols, colW, lines };
      if (height <= rect.height) return plan;
      fallback = plan;
    }
  }
  return fallback!;
}

/** 静止表示の番号付き一覧。図の中と同じ番号の丸を頭に付ける。 */
function captionIndex(ctx: RenderCtx, rect: Rect, steps: CompiledStep[]): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  const r = 10;
  const indent = r * 2 + 10;
  const plan = planIndex(ctx, rect, steps, indent);
  const body = { ...t.font.caption, size: plan.size };
  const digit = { ...t.font.badge, size: 12 };
  const per = Math.ceil(steps.length / plan.cols);
  const items: ReactNode[] = [];
  for (let c = 0; c < plan.cols; c++) {
    const x = rect.x + c * (plan.colW + INDEX_GUTTER);
    let y = rect.y;
    steps.slice(c * per, (c + 1) * per).forEach((s, i) => {
      const lines = plan.lines[c * per + i];
      items.push(
        <g key={s.index}>
          <g transform={`translate(${x + r} ${y + body.size * 0.55})`}>{badgeDisc(pal, s.n, r, 'done', digit)}</g>
          {Text({ x: x + indent, y, lines, font: body, fill: pal.ink, leading: INDEX_LEADING })}
        </g>,
      );
      y += textHeight(lines.length, body, INDEX_LEADING) + body.size * 0.45;
    });
  }
  return <g>{items}</g>;
}

function Citation(ctx: RenderCtx, rect: Rect, sources: Source[]): ReactNode {
  const pal = paletteOf(ctx);
  const t = ctx.skin.tokens;
  if (sources.length === 0) return null;
  const text = '出典: ' + sources.map(formatSource).join(' ／ ');
  const lines = wrapLines(text, rect.width, ctx.measure, t.font.citation).slice(0, 2);
  return Text({ x: rect.x, y: rect.y, lines, font: t.font.citation, fill: pal.inkSoft, leading: 1.45 });
}

/** 「ひらく」の印は丸の右下に寄せた小さな三角、輪は丸を囲む破線の円にする（箱の角だと丸から遠い）。 */
function OpenMark(ctx: RenderCtx, box: NodeBox): { mark: ReactNode; ring: ReactNode } {
  const t = ctx.skin.tokens;
  const { cx, cy } = box;
  const near = 12;
  const far = DISC_R + 4;
  return {
    mark: <path d={`M${cx + near} ${cy + far}L${cx + far} ${cy + near}L${cx + far} ${cy + far}Z`} fill={t.tone.accent1} />,
    ring: <circle cx={cx} cy={cy} r={DISC_R + RING_GAP + 6} fill="none" stroke={t.tone.accent1} strokeWidth={2.5} strokeDasharray="6 5" />,
  };
}

const drawing = {
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
  OpenMark,
};

const fonts = [{ family: FONT, googleId: 'Zen+Maru+Gothic', weights: [500, 700] }];

export const plainSkin: Skin = { id: 'plain', name: '略図', tokens: tokensOf(LIGHT, false), fonts, ...drawing };

/** 画面をダークにしたときの略図。形と寸法は明るい版と同じで、色だけが違う */
export const plainDarkSkin: Skin = { id: 'plain-dark', name: '略図', tokens: tokensOf(DARK, true), fonts, ...drawing };
