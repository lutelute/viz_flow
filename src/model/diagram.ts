// 図の定義。見た目（色・形・フォント）は書かず、構造と物語だけを書く。
// 実際の色や形はスキン（src/skins）が kind と tone から決める。

export type NodeKind =
  | 'user' | 'query' | 'documents' | 'chunker' | 'embedding' | 'vectordb' | 'graphdb'
  | 'retriever' | 'reranker' | 'grader' | 'router' | 'prompt' | 'llm' | 'answer'
  | 'web' | 'tool' | 'agent' | 'memory' | 'policy' | 'encoder' | 'index' | 'image' | 'generic';

export type PayloadKind =
  | 'text' | 'query' | 'vector' | 'chunks' | 'prompt' | 'answer' | 'image'
  | 'graph' | 'score' | 'plan' | 'tokens' | 'compressed' | 'generic';

/** 色はトーン名で指定する。hex はスキンが持つ。 */
export type ToneId = 'ink' | 'accent1' | 'accent2' | 'accent3' | 'ok' | 'ng' | 'warn' | 'muted';

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** 粒子の中身。ノードを通るたびに kind と label が変わる。 */
export interface Payload {
  kind: PayloadKind;
  /** 図中の短い語。「質問」「ベクトル」「文書×3」 */
  label?: string;
  /** chunks など複数形の描画に使う枚数 */
  count?: number;
  tone?: ToneId;
  /** HyDE の仮の文書のように「あとで捨てる」ものを半透明で描く */
  ghost?: boolean;
}

export interface Lane {
  id: string;
  /** 「索引づくり（オフライン）」など */
  label?: string;
  tone?: ToneId;
  frame?: 'band' | 'outline' | 'none';
}

export interface DiagramNode {
  id: string;
  kind: NodeKind;
  /** 日本語。'\n' で手動改行できる */
  label: string;
  /** モデル名などの補足 */
  sublabel?: string;
  lane: string;
  /** 0 始まりの列。省略時は最長路から補う */
  col?: number;
  /** レーン内の行。並列ノード用。既定 0 */
  row?: number;
  size?: 'sm' | 'md' | 'lg';
  /** muted = 共通の骨格、new = この手法で足された要素 */
  emphasis?: 'normal' | 'muted' | 'new';
  /** kind の既定アイコンを上書き */
  icon?: string;
  /** 例外的な手置き。グリッドより優先 */
  at?: { x: number; y: number };
}

/** 「MCP サーバー」「メモリ」のような視覚的な束 */
export interface DiagramGroup {
  id: string;
  label?: string;
  nodes: string[];
  tone?: ToneId;
}

export type EdgeRole = 'main' | 'branch' | 'loop' | 'ref';

export type Via = { col: number; lane?: string; row?: number } | { x: number; y: number };

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  /** 「類似検索」「正しい」など */
  label?: string;
  /** ラベル位置 0..1。既定 0.5、branch は 0.35 */
  labelAt?: number;
  role?: EdgeRole;
  /** 同じ group の枝は同じ分岐点から束で出る */
  branch?: { group: string; option: string };
  fromSide?: Side;
  toSide?: Side;
  via?: Via[];
  arrow?: 'end' | 'none' | 'both';
  line?: 'solid' | 'dashed' | 'dotted';
  tone?: ToneId;
}

export type StepAction =
  | { type: 'travel'; particle: string; edges: string[]; payload: Payload }
  | { type: 'dwell'; particle: string; node: string; seconds?: number; label?: string }
  | { type: 'split'; particle: string; at: string; into: Array<{ particle: string; payload: Payload }> }
  | { type: 'merge'; particles: string[]; at: string; into: { particle: string; payload: Payload } }
  | { type: 'end'; particle: string; mode?: 'absorb' | 'stay' }
  | { type: 'highlight'; nodes?: string[]; edges?: string[]; lanes?: string[]; groups?: string[] };

export type BadgeAnchor =
  | { edge: string; at?: number }
  | { node: string; corner?: 'ne' | 'nw' | 'se' | 'sw' };

export interface Step {
  /** ① の数字 */
  n: number;
  /** 図中バッジ横の短い語 */
  short?: string;
  /** パネル用の 1 文。番号は自動で付く */
  caption: string;
  detail?: string;
  badge?: BadgeAnchor;
  actions: StepAction[];
  /** ステップ末の静止秒 */
  hold?: number;
}

export interface Source {
  title: string;
  authors: string;
  year: number;
  venue?: string;
  arxiv?: string;
  doi?: string;
  url?: string;
  /** 図のどこが論文のどの節に対応するか */
  note?: string;
}

export interface LayoutHints {
  colWidth?: number;
  rowHeight?: number;
  laneGap?: number;
  padding?: number;
  /** 粒子速度。既定 220 px/秒 */
  speedPxPerSec?: number;
}

export interface Diagram {
  id: string;
  title: string;
  subtitle?: string;
  /** 配列順が上から下 */
  lanes: Lane[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  steps: Step[];
  /** ⑤〜⑦ を 2 回、など。番号は増やさず「2 回目」と添える */
  loops?: Array<{ steps: [number, number]; times: number }>;
  sources: Source[];
  layout?: LayoutHints;
}

export type Composition =
  | { kind: 'single'; id: string; diagram: Diagram }
  | {
      kind: 'grid';
      id: string;
      title: string;
      columns: number;
      cells: Array<{ diagram: Diagram; span?: { cols?: number; rows?: number } }>;
      sync: 'independent' | 'lockstep';
      sources?: Source[];
    }
  | {
      kind: 'stack';
      id: string;
      title: string;
      direction: 'vertical' | 'horizontal';
      items: Array<{ heading: string; diagram: Diagram }>;
      sync: 'lockstep';
    };

export function diagramsOf(c: Composition): Diagram[] {
  switch (c.kind) {
    case 'single': return [c.diagram];
    case 'grid': return c.cells.map((x) => x.diagram);
    case 'stack': return c.items.map((x) => x.diagram);
  }
}
