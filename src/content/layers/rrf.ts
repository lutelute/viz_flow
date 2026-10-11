import type { Diagram } from '../../model/diagram';

// RRF の中。点数の尺度が違う検索器どうしを、順位だけで混ぜる。

export const insideRrf: Diagram = {
  id: 'inside-rrf',
  title: 'RRF の中',
  subtitle: '尺度の違う検索結果を、順位だけを使って 1 つの順位にまとめる',
  lanes: [{ id: 'fuse', label: '順位から点数を作って足す', tone: 'accent1', frame: 'band' }],
  nodes: [
    { id: 'in-a', kind: 'port', label: '順位表 A', sublabel: '外の図から入る', lane: 'fuse', col: 0, row: 0, emphasis: 'muted' },
    { id: 'in-b', kind: 'port', label: '順位表 B', sublabel: '外の図から入る', lane: 'fuse', col: 0, row: 1, emphasis: 'muted' },
    { id: 'conv', kind: 'grader', label: '順位を\n点数に', sublabel: '1/(60+順位)', lane: 'fuse', col: 1, row: 0, emphasis: 'new' },
    { id: 'sum', kind: 'embedding', label: '同じ文書を\n足す', sublabel: '両方で上位なら高い', lane: 'fuse', col: 2, row: 0 },
    { id: 'sort', kind: 'reranker', label: '並べ直す', sublabel: '合計点の順', lane: 'fuse', col: 3, row: 0 },
    { id: 'out', kind: 'port', label: '融合した順位', sublabel: '外の図へ出る', lane: 'fuse', col: 3, row: 1, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-a-conv', from: 'in-a', to: 'conv' },
    { id: 'e-b-conv', from: 'in-b', to: 'conv', fromSide: 'right', toSide: 'bottom' },
    { id: 'e-conv-sum', from: 'conv', to: 'sum' },
    { id: 'e-sum-sort', from: 'sum', to: 'sort' },
    { id: 'e-sort-out', from: 'sort', to: 'out', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    {
      n: 1,
      short: '受け取る',
      caption: '検索ごとの順位表を受け取る。検索器が違う場合も、質問の言い換えが違う場合もある。点数は尺度がそろわないので捨て、順位だけを使う',
      actions: [
        { type: 'travel', particle: 'a', edges: ['e-a-conv'], payload: { kind: 'chunks', label: '順位表 A', count: 3 } },
        { type: 'travel', particle: 'b', edges: ['e-b-conv'], payload: { kind: 'chunks', label: '順位表 B', count: 3 } },
      ],
    },
    {
      n: 2,
      short: '点数に',
      caption: '各文書に 1/(k+順位) の点数を付ける。k は 60。1 位は 1/61、10 位は 1/70 で、差は緩やか',
      actions: [
        { type: 'merge', particles: ['a', 'b'], at: 'conv', into: { particle: 's', payload: { kind: 'score', label: '点数' } } },
        { type: 'dwell', particle: 's', node: 'conv', seconds: 0.6, label: '1/(60+順位)' },
      ],
    },
    {
      n: 3,
      short: '足す',
      caption: '同じ文書が両方の表に出ていれば点数を足す。どちらでも上位にいる文書ほど高くなる',
      actions: [{ type: 'travel', particle: 's', edges: ['e-conv-sum'], payload: { kind: 'score', label: '点数' } }],
    },
    {
      n: 4,
      short: '並べる',
      caption: '合計点の順に並べ直す',
      actions: [{ type: 'travel', particle: 's', edges: ['e-sum-sort'], payload: { kind: 'score', label: '合計点' } }],
    },
    {
      n: 5,
      short: '渡す',
      caption: '上から K 件を外の図に返す。学習も重みの調整も要らない',
      actions: [
        { type: 'travel', particle: 's', edges: ['e-sort-out'], payload: { kind: 'chunks', label: '融合した順位', count: 3 } },
        { type: 'end', particle: 's', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods',
      authors: 'Cormack, G. V., Clarke, C. L. A., Büttcher, S.',
      year: 2009,
      venue: 'SIGIR 2009',
      doi: '10.1145/1571941.1572114',
      note: 'RRF の式 Σ 1/(k+順位)、k=60 はこの論文',
    },
  ],
};
