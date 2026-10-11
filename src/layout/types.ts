import type { Side } from '../model/diagram';
import type { Route } from '../core/particle-math';

export interface Pt { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }

export type FrameAspect = '4:5' | '9:16' | '1:1' | 'free';

/** 文字幅の測定。canvas 実装と平均字幅テーブル実装を差し替えられるようにする。 */
export interface TextMeasurer {
  width(text: string, family: string, size: number, weight?: number): number;
}

export interface GridTokens {
  colWidth: number;
  rowHeight: number;
  laneGap: number;
  padding: number;
  /** レーン見出しの高さ。見出しが無いレーンでは 0 扱い */
  laneHeader: number;
}

export interface NodeSizeMin { w: number; h: number }

/** レイアウトがスキンから必要とする値だけを切り出した型。Skin.tokens がこれを満たす。 */
export interface LayoutStyle {
  grid: GridTokens;
  font: {
    label: { family: string; size: number; weight: number };
    sublabel: { family: string; size: number; weight: number };
    edge: { family: string; size: number; weight: number };
  };
  nodeMin: Record<'sm' | 'md' | 'lg', NodeSizeMin>;
  /** ノード箱の内側余白（文字とアイコンの周り） */
  nodePad: number;
  /** アイコンの一辺 */
  iconSize: number;
  /** false なら補足（sublabel）を折り返さず、その高さも取らない。既定 true */
  showSublabel?: boolean;
  /** ノードを丸で描く様式の丸の半径。NodeBox.disc に写す */
  disc?: number;
  /** 配線の角丸。製図は 0 */
  corner: number;
  /** ポートから最初の折れ点までの突き出し */
  stub: number;
  /** 同じチャネルを通る線どうしの間隔 */
  track: number;
  measure: TextMeasurer;
}

/** ノードが占めるグリッド上の位置。col は補完済み */
export interface Cell {
  lane: string;
  col: number;
  row: number;
}

export interface LaneGeom {
  rect: Rect;
  /** 見出し帯の高さ。見出しが無ければ 0 */
  header: number;
  rows: number;
}

/** ルータがチャネル（列間・行間・レーン外周の隙間）を求めるのに使うグリッドの寸法 */
export interface GridGeom {
  originX: number;
  colWidth: number;
  rowHeight: number;
  laneGap: number;
  cols: number;
  /** レーン id の配列順（上から下） */
  laneOrder: string[];
  lanes: Map<string, LaneGeom>;
  cells: Map<string, Cell>;
}

export interface NodeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  ports: Record<Side, Pt>;
  labelLines: string[];
  sublabelLines: string[];
  /** 様式が箱ではなく丸を描くときの丸の半径（中心は cx, cy）。角に付くバッジを丸に寄せるのに使う */
  disc?: number;
}

export interface EdgeLabelGeom {
  pos: Pt;
  anchor: 'start' | 'middle' | 'end';
  lines: string[];
  box: Rect;
}

export interface EdgeGeom {
  id: string;
  /** 折れ線（角丸前）。幾何の正 */
  points: Pt[];
  /** 角丸済みの SVG パス */
  d: string;
  /** 粒子用。角を円弧サンプルに置き換えた折れ線から作る */
  route: Route;
  label?: EdgeLabelGeom;
  arrowAt: Pt;
  /** 度。0 = 右向き */
  arrowAngle: number;
  /** 番号バッジの既定位置（ラベルの反対側） */
  badgeAt: Pt;
}

export type LayoutWarningKind =
  | 'edge-crosses-node'
  | 'node-overlap'
  | 'label-overlaps-node'
  | 'label-overlap'
  | 'missing-ref'
  | 'cell-collision'
  | 'figure-overflow';

export interface LayoutWarning {
  kind: LayoutWarningKind;
  ids: string[];
  message: string;
}

export interface ResolvedLayout {
  size: Size;
  title: Rect;
  figure: Rect;
  caption?: Rect;
  citation: Rect;
  lanes: Map<string, Rect>;
  groups: Map<string, Rect>;
  nodes: Map<string, NodeBox>;
  edges: Map<string, EdgeGeom>;
  warnings: LayoutWarning[];
}
