import type { ReactNode } from 'react';
import type { DiagramEdge, DiagramGroup, DiagramNode, Lane, NodeKind, PayloadKind, Source, ToneId } from '../model/diagram';
import type { EdgeGeom, LayoutStyle, NodeBox, Pt, Rect, Size, TextMeasurer } from '../layout/types';
import type { CompiledStep, FrameState, NodeState, ParticleFrame, Phase } from '../timeline/types';

export type SkinId = 'sketch' | 'blueprint' | 'editorial' | 'neon' | 'plain' | 'plain-dark';

export interface FontSpec {
  family: string;
  /** Google Fonts の family 指定。例 'Klee+One' */
  googleId: string;
  weights: number[];
}

export interface FontFace { family: string; size: number; weight: number }

export interface SkinTokens {
  bg: string;
  bg2: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineSoft: string;
  tone: Record<ToneId, string>;
  /** ノード面の色。不透明な hex */
  fill: Partial<Record<NodeKind, string>>;
  payloadTone: Record<PayloadKind, ToneId>;
  font: {
    title: FontFace;
    subtitle: FontFace;
    label: FontFace;
    sublabel: FontFace;
    edge: FontFace;
    badge: FontFace;
    caption: FontFace;
    particle: FontFace;
    lane: FontFace;
    citation: FontFace;
  };
  stroke: { node: number; edge: number; lane: number; group: number; icon: number };
  radius: { node: number; lane: number; corner: number };
  arrow: { kind: 'chevron-open' | 'triangle' | 'triangle-small' | 'barb'; size: number };
  particle: { size: number; labelGap: number };
  grid: LayoutStyle['grid'];
  nodeMin: LayoutStyle['nodeMin'];
  nodePad: number;
  iconSize: number;
  stub: number;
  track: number;
  texture: 'paper' | 'graph' | 'dots' | 'none';
  dark: boolean;
  /** false なら補足を描かず、レイアウトも場所を取らない。既定 true */
  showSublabel?: boolean;
  /** ノードを丸で描く様式の丸の半径。角に付くバッジの位置を丸に合わせる */
  disc?: number;
}

export interface RenderCtx {
  skin: Skin;
  diagramId: string;
  mode: 'animated' | 'static';
  /** 手描き様式の決定性のため。fnv1a(diagramId + key) */
  seed: (key: string) => number;
  measure: TextMeasurer;
}

/**
 * 様式。React コンポーネントではなく描画関数の束にする。
 * renderToStaticMarkup からも同じ関数で呼べ、参照が安定するのでメモ化が効く。
 */
export interface Skin {
  id: SkinId;
  /** 日本語の表示名 */
  name: string;
  tokens: SkinTokens;
  fonts: FontSpec[];
  /** filter / pattern / symbol。1 回だけ */
  Defs(ctx: RenderCtx): ReactNode;
  Background(ctx: RenderCtx, size: Size): ReactNode;
  Title(ctx: RenderCtx, rect: Rect, title: string, subtitle?: string): ReactNode;
  Lane(ctx: RenderCtx, lane: Lane, rect: Rect): ReactNode;
  Group(ctx: RenderCtx, group: DiagramGroup, rect: Rect): ReactNode;
  Node(ctx: RenderCtx, node: DiagramNode, box: NodeBox, state: NodeState): ReactNode;
  /** 線 + 矢印 + ラベル */
  Edge(ctx: RenderCtx, edge: DiagramEdge, geom: EdgeGeom, phase: Phase): ReactNode;
  /** payload.kind で描き分ける */
  Particle(ctx: RenderCtx, pf: ParticleFrame): ReactNode;
  Badge(ctx: RenderCtx, n: number, pos: Pt, phase: Phase, short?: string): ReactNode;
  CaptionStrip(ctx: RenderCtx, rect: Rect, steps: CompiledStep[], active: number): ReactNode;
  Citation(ctx: RenderCtx, rect: Rect, sources: Source[]): ReactNode;
  /**
   * 「ひらく」の印（いつも出す）と、押せることを示す輪（ホバーとフォーカスの時だけ出す）。画面専用。
   * 省略時は箱の右下を折った三角と、箱を囲む破線の角丸四角になる。丸いノードを描く様式は丸に合わせて上書きする。
   */
  OpenMark?(ctx: RenderCtx, box: NodeBox): { mark: ReactNode; ring: ReactNode };
}

/** LayoutStyle をスキンから組み立てる。 */
export function layoutStyleOf(skin: Skin, measure: TextMeasurer): LayoutStyle {
  const t = skin.tokens;
  return {
    grid: t.grid,
    font: { label: t.font.label, sublabel: t.font.sublabel, edge: t.font.edge },
    nodeMin: t.nodeMin,
    nodePad: t.nodePad,
    iconSize: t.iconSize,
    showSublabel: t.showSublabel,
    disc: t.disc,
    corner: t.radius.corner,
    stub: t.stub,
    track: t.track,
    measure,
  };
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function makeCtx(skin: Skin, diagramId: string, mode: FrameState['mode'], measure: TextMeasurer): RenderCtx {
  return { skin, diagramId, mode, measure, seed: (key) => fnv1a(`${diagramId}#${key}`) };
}
