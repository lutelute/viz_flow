import type { Diagram } from '../../model/diagram';

// ベクトル DB の中。HNSW（層つきの近さのグラフ）で近似最近傍を探す。
// 返すのは答えではなく、ID から引いた本文（チャンク）。

export const insideVectordb: Diagram = {
  id: 'inside-vectordb',
  title: 'ベクトル DB の中',
  subtitle: '全件と比べずに、近いベクトルをグラフをたどって素早く探す',
  lanes: [
    { id: 'store', label: 'しまう（あらかじめ）', tone: 'accent1', frame: 'band' },
    { id: 'search', label: '探す（そのつど）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'in-s', kind: 'port', label: 'ベクトルと本文', sublabel: '外の図から入る', lane: 'store', col: 0, emphasis: 'muted' },
    { id: 'keep', kind: 'memory', label: '番号を振って\n保管', sublabel: '本文も同じ ID で', lane: 'store', col: 1 },
    { id: 'graph', kind: 'graphdb', label: '近さの\nグラフ', sublabel: 'HNSW。上の層ほどまばら', lane: 'store', col: 2, emphasis: 'new' },
    { id: 'in-q', kind: 'port', label: '質問の\nベクトル', sublabel: '外の図から入る', lane: 'search', col: 0, emphasis: 'muted' },
    { id: 'descend', kind: 'retriever', label: '上の層から\nたどる', sublabel: '近い方へ進む', lane: 'search', col: 1 },
    { id: 'cand', kind: 'retriever', label: '候補を\n広げる', sublabel: '最下層で ef 個', lane: 'search', col: 2 },
    { id: 'topk', kind: 'reranker', label: '近い順に\nK 件', sublabel: 'cosine か内積', lane: 'search', col: 3 },
    { id: 'out', kind: 'port', label: '上位 K 件', sublabel: '外の図へ出る', lane: 'search', col: 3, row: 1, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-in-keep', from: 'in-s', to: 'keep' },
    { id: 'e-keep-graph', from: 'keep', to: 'graph' },
    { id: 'e-graph-cand', from: 'graph', to: 'cand', label: '同じグラフ', fromSide: 'bottom', toSide: 'top', role: 'ref', line: 'dashed' },
    { id: 'e-q-descend', from: 'in-q', to: 'descend' },
    { id: 'e-descend-cand', from: 'descend', to: 'cand' },
    { id: 'e-cand-topk', from: 'cand', to: 'topk' },
    { id: 'e-topk-out', from: 'topk', to: 'out', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    {
      n: 1,
      short: 'しまう',
      caption: '届いたチャンクに番号（ID）を振り、ベクトルと本文と出どころを同じ ID で保管する',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-in-keep'], payload: { kind: 'chunks', label: 'ベクトルと本文', count: 3 } }],
    },
    {
      n: 2,
      short: '結ぶ',
      caption: 'ベクトルをグラフに足し、近いベクトルどうしを線で結ぶ。上の層ほど点が少なく、遠くまで一気に進める',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-keep-graph'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'd', mode: 'absorb' },
      ],
    },
    {
      n: 3,
      short: '入口',
      caption: '質問のベクトルが来たら、最上層の入口から、より近い点へと線をたどって進む',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-q-descend'], payload: { kind: 'vector', label: '質問' } }],
    },
    {
      n: 4,
      short: '降りる',
      caption: 'それ以上近づけなくなったら一段下の層へ降りる。最下層では候補を ef 個まで広げて探す',
      actions: [
        { type: 'highlight', edges: ['e-graph-cand'], nodes: ['graph'] },
        { type: 'travel', particle: 'q', edges: ['e-descend-cand'], payload: { kind: 'vector', label: '質問' } },
      ],
    },
    {
      n: 5,
      short: '選ぶ',
      caption: '候補を類似度で並べ、上位 K 件を選ぶ。全件とは比べないので速いが、まれに一番近いものを取りこぼす',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-cand-topk'], payload: { kind: 'score', label: '候補' } }],
    },
    {
      n: 6,
      short: '返す',
      caption: 'ID から本文を引いて、チャンクとして返す。ベクトル DB が返すのは答えではなく文書',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-topk-out'], payload: { kind: 'chunks', label: '上位 K 件', count: 3 } },
        { type: 'end', particle: 'q', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs',
      authors: 'Malkov, Y. A., Yashunin, D. A.',
      year: 2020,
      venue: 'IEEE TPAMI 42(4)',
      arxiv: '1603.09320',
      note: '層つきのグラフと、上の層から貪欲にたどって降りる探索。ef は探索で持つ候補の数',
    },
  ],
};
