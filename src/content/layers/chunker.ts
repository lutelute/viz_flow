import type { Diagram } from '../../model/diagram';
import { gao2023 } from './sources';

// チャンク分割の中。区切り方と長さと重なりに定説は無いので、数値は「例」として描く。

export const insideChunker: Diagram = {
  id: 'inside-chunker',
  title: 'チャンク分割の中',
  subtitle: '長い文書を、検索で扱いやすい長さの塊に切り分ける',
  lanes: [
    { id: 'cut', label: '区切って詰める', tone: 'accent1', frame: 'band' },
    { id: 'mark', label: '重ねて、出どころを付ける', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'in', kind: 'port', label: '文書', sublabel: '外の図から入る', lane: 'cut', col: 0, emphasis: 'muted' },
    { id: 'extract', kind: 'documents', label: '本文を\n取り出す', sublabel: 'PDF の文字や表', lane: 'cut', col: 1 },
    { id: 'split', kind: 'chunker', label: '境目で区切る', sublabel: '段落、長ければ文', lane: 'cut', col: 2 },
    { id: 'pack', kind: 'chunker', label: '長さまで\n詰める', sublabel: '例: 512 トークン', lane: 'cut', col: 3 },
    { id: 'overlap', kind: 'chunker', label: '前と重ねる', sublabel: '例: 50 トークン', lane: 'mark', col: 2 },
    { id: 'meta', kind: 'index', label: '出どころを\n付ける', sublabel: 'ファイル名とページ', lane: 'mark', col: 1 },
    { id: 'out', kind: 'port', label: 'チャンク', sublabel: '外の図へ出る', lane: 'mark', col: 0, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-in-extract', from: 'in', to: 'extract' },
    { id: 'e-extract-split', from: 'extract', to: 'split' },
    { id: 'e-split-pack', from: 'split', to: 'pack' },
    { id: 'e-pack-overlap', from: 'pack', to: 'overlap', fromSide: 'bottom', toSide: 'right' },
    { id: 'e-overlap-meta', from: 'overlap', to: 'meta', fromSide: 'left', toSide: 'right' },
    { id: 'e-meta-out', from: 'meta', to: 'out', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '取り出す',
      caption: '文書から本文の文字を取り出す。PDF なら表や図の説明文も文字にする',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-in-extract'], payload: { kind: 'text', label: '文書' } }],
    },
    {
      n: 2,
      short: '区切る',
      caption: '段落の境目で区切る。段落が長すぎれば文の境目で区切り、文の途中では切らない',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-extract-split'], payload: { kind: 'text', label: '本文' } }],
    },
    {
      n: 3,
      short: '詰める',
      caption: '上限の長さに届くまで、区切りを順に詰めて 1 つの塊にする',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-split-pack'], payload: { kind: 'chunks', label: '区切り', count: 3 } }],
    },
    {
      n: 4,
      short: '重ねる',
      badge: { edge: 'e-pack-overlap', at: 0.3 },
      caption: '次の塊の頭に、前の塊の末尾を少し重ねる。境目にまたがる話をどちらの塊にも残すため',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-pack-overlap'], payload: { kind: 'chunks', label: '塊', count: 3 } }],
    },
    {
      n: 5,
      short: '出どころ',
      caption: '塊ごとに番号と出どころ（ファイル名とページ）を付ける。回答で引用を示すのに使う',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-overlap-meta'], payload: { kind: 'chunks', label: '塊', count: 3 } }],
    },
    {
      n: 6,
      short: '渡す',
      caption: 'こうしてできた塊がチャンク。外の図では、この後に埋め込みモデルへ進む',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-meta-out'], payload: { kind: 'chunks', label: 'チャンク', count: 3 } },
        { type: 'end', particle: 'd', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Dense Passage Retrieval for Open-Domain Question Answering',
      authors: 'Karpukhin, V. ほか',
      year: 2020,
      venue: 'EMNLP 2020',
      arxiv: '2004.04906',
      note: 'Wikipedia を重なりなしの 100 語ずつに切っている。元の RAG 論文もこの切り方を使う。重ねるのは後の実務の工夫',
    },
    { ...gao2023, note: '索引づくりの工夫としてチャンクの切り方を挙げている。大きさと重なりに定説は無く、図の数値は一般的な設定の例' },
  ],
};
