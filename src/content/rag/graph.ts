import type { Diagram } from '../../model/diagram';

// GraphRAG（Microsoft）。LLM で抜いたエンティティと関係からグラフを組み、Leiden でコミュニティに分け、
// 各コミュニティの要約を先に作っておく。全体についての質問には、要約ごとの部分回答を Map し、
// 点数順に Reduce して答える。グラフを「たどって」答えるわけではない。

export const graphRag: Diagram = {
  id: 'graph-rag',
  title: 'GraphRAG',
  subtitle: '文書からグラフを組み、コミュニティごとの要約を先に作っておいて、全体の問いに答える',
  lanes: [
    { id: 'index', label: '索引づくり（あらかじめ）', tone: 'accent1', frame: 'band' },
    { id: 'query', label: '全体についての質問に答える', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書群', lane: 'index', col: 0, row: 0, emphasis: 'muted' },
    { id: 'chunker', kind: 'chunker', label: 'チャンク\n分割', lane: 'index', col: 1, row: 0, emphasis: 'muted', opens: 'inside-chunker' },
    { id: 'extract', kind: 'llm', label: 'LLM で抽出', sublabel: 'エンティティと関係', lane: 'index', col: 2, row: 0, emphasis: 'new', opens: 'inside-llm' },
    { id: 'graph', kind: 'graphdb', label: '知識グラフ', lane: 'index', col: 3, row: 0, emphasis: 'new' },
    { id: 'leiden', kind: 'router', label: 'コミュニティ\n検出', sublabel: 'Leiden で階層に', lane: 'index', col: 3, row: 1, emphasis: 'new' },
    { id: 'summary', kind: 'llm', label: 'コミュニティ\n要約', sublabel: '先に作っておく', lane: 'index', col: 2, row: 1, emphasis: 'new' },
    { id: 'user', kind: 'user', label: '質問', sublabel: '「主題は何か」のような', lane: 'query', col: 0 },
    { id: 'map', kind: 'llm', label: 'Map', sublabel: '要約ごとに部分回答と点数', lane: 'query', col: 1, emphasis: 'new', opens: 'inside-llm' },
    { id: 'reduce', kind: 'reranker', label: 'Reduce', sublabel: '点数順に積んで統合', lane: 'query', col: 2, emphasis: 'new' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'query', col: 3 },
  ],
  edges: [
    { id: 'e-docs-chunk', from: 'docs', to: 'chunker' },
    { id: 'e-chunk-extract', from: 'chunker', to: 'extract' },
    { id: 'e-extract-graph', from: 'extract', to: 'graph' },
    { id: 'e-graph-leiden', from: 'graph', to: 'leiden' },
    { id: 'e-leiden-summary', from: 'leiden', to: 'summary', fromSide: 'left', toSide: 'right' },
    { id: 'e-summary-map', from: 'summary', to: 'map', label: '要約を全部', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-map', from: 'user', to: 'map' },
    { id: 'e-map-reduce', from: 'map', to: 'reduce' },
    { id: 'e-reduce-answer', from: 'reduce', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '分割',
      caption: '文書をチャンクに分ける',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-docs-chunk'], payload: { kind: 'text', label: '文書' } }],
    },
    {
      n: 2,
      short: '抽出',
      caption: 'LLM が各チャンクからエンティティと関係を抜き出す。取りこぼしが無いか LLM に再確認させる',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-chunk-extract'], payload: { kind: 'chunks', label: '文書×3', count: 3 } },
        { type: 'dwell', particle: 'd', node: 'extract', seconds: 0.8, label: '抽出中' },
      ],
    },
    {
      n: 3,
      short: 'グラフ',
      caption: 'エンティティを点、関係を線にしてグラフを組む',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-extract-graph'], payload: { kind: 'graph', label: '点と線' } }],
    },
    {
      n: 4,
      short: 'コミュニティ',
      caption: 'Leiden 法でグラフを階層的なコミュニティに分ける',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-graph-leiden'], payload: { kind: 'graph', label: 'グラフ' } },
        { type: 'dwell', particle: 'd', node: 'leiden', seconds: 0.6 },
      ],
    },
    {
      n: 5,
      short: '要約を先に',
      caption: '各コミュニティの要約を LLM で先に作っておく。質問が来る前に済ませる',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-leiden-summary'], payload: { kind: 'graph', label: 'コミュニティ' } },
        { type: 'dwell', particle: 'd', node: 'summary', seconds: 0.8, label: '要約中' },
      ],
    },
    {
      n: 6,
      short: 'Map',
      caption: '質問に対し、要約ごとに部分回答と役立ち度の点数を並列に出す',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-summary-map'], payload: { kind: 'text', label: '要約×N' } },
        { type: 'travel', particle: 'q', edges: ['e-user-map'], payload: { kind: 'query', label: '質問' } },
        { type: 'merge', particles: ['d', 'q'], at: 'map', into: { particle: 'm', payload: { kind: 'score', label: '部分回答' } } },
        { type: 'dwell', particle: 'm', node: 'map', seconds: 0.6, label: '並列に' },
      ],
    },
    {
      n: 7,
      short: 'Reduce',
      caption: '点数の高い順に部分回答を積み、1 つの回答にまとめる',
      actions: [
        { type: 'travel', particle: 'm', edges: ['e-map-reduce'], payload: { kind: 'score', label: '点数つき' } },
        { type: 'travel', particle: 'm', edges: ['e-reduce-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'm', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'From Local to Global: A Graph RAG Approach to Query-Focused Summarization',
      authors: 'Edge, D. ほか（Microsoft Research）',
      year: 2024,
      arxiv: '2404.16130',
      note: '図は論文の Global Search。索引の 6 段と Map-Reduce は論文の Figure 1 に対応する。Local Search は公式ドキュメントの機能',
    },
  ],
};
