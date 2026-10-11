import type { Diagram } from '../../model/diagram';

// HybridRAG（Sarmah ほか 2024）。同じ文書からチャンクのベクトル DB と三つ組の知識グラフを両方作り、
// 質問に対してベクトル検索と部分グラフの 2 種類の文脈を連結して 1 回で答える。
// 「密＋疎（BM25）」のハイブリッド検索は別物。

export const hybridRag: Diagram = {
  id: 'hybrid-rag',
  title: 'HybridRAG',
  subtitle: '同じ文書をベクトル DB と知識グラフの両方に入れ、2 種類の文脈を連結して答える',
  lanes: [
    { id: 'index', label: '索引づくり（あらかじめ、2 系統）', tone: 'accent1', frame: 'band' },
    { id: 'query', label: '質問に答える（2 種類の検索）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書群', lane: 'index', col: 0, row: 0, emphasis: 'muted' },
    { id: 'chunker', kind: 'chunker', label: 'チャンク\n分割', lane: 'index', col: 1, row: 0, emphasis: 'muted' },
    { id: 'embed', kind: 'embedding', label: '埋め込み\nモデル', lane: 'index', col: 2, row: 0, emphasis: 'muted' },
    { id: 'vecdb', kind: 'vectordb', label: 'ベクトル DB', lane: 'index', col: 3, row: 0, emphasis: 'muted' },
    { id: 'extract', kind: 'llm', label: 'LLM で\n三つ組を抽出', sublabel: '主語・関係・目的語', lane: 'index', col: 1, row: 1, emphasis: 'new' },
    { id: 'graphdb', kind: 'graphdb', label: '知識グラフ', lane: 'index', col: 2, row: 1, emphasis: 'new' },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'query', col: 0, row: 0 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'query', col: 0, row: 1 },
    { id: 'concat', kind: 'prompt', label: '文脈を連結', sublabel: 'ベクトルを先、グラフを後', lane: 'query', col: 1, row: 0, emphasis: 'new' },
    { id: 'user', kind: 'user', label: '質問', lane: 'query', col: 1, row: 1 },
    { id: 'gsearch', kind: 'graphdb', label: 'グラフ\n検索', sublabel: '深さ 1 の部分グラフ', lane: 'query', col: 2, row: 1, emphasis: 'new' },
    { id: 'vsearch', kind: 'retriever', label: 'ベクトル\n検索', sublabel: '上位の数件', lane: 'query', col: 3, row: 0 },
  ],
  edges: [
    { id: 'e-docs-chunk', from: 'docs', to: 'chunker' },
    { id: 'e-chunk-embed', from: 'chunker', to: 'embed' },
    { id: 'e-embed-db', from: 'embed', to: 'vecdb' },
    { id: 'e-docs-extract', from: 'docs', to: 'extract', fromSide: 'bottom', toSide: 'left' },
    { id: 'e-extract-graph', from: 'extract', to: 'graphdb' },
    { id: 'e-db-vsearch', from: 'vecdb', to: 'vsearch', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-graph-gsearch', from: 'graphdb', to: 'gsearch', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-vsearch', from: 'user', to: 'vsearch', fromSide: 'right', toSide: 'left' },
    { id: 'e-user-gsearch', from: 'user', to: 'gsearch', fromSide: 'right', toSide: 'left' },
    { id: 'e-vsearch-concat', from: 'vsearch', to: 'concat', fromSide: 'left', toSide: 'right' },
    { id: 'e-gsearch-concat', from: 'gsearch', to: 'concat', fromSide: 'left', toSide: 'right' },
    { id: 'e-concat-llm', from: 'concat', to: 'llm', fromSide: 'left', toSide: 'right' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    {
      n: 1,
      short: 'ベクトル側',
      caption: '文書をチャンクに分け、埋め込みモデルでベクトルにしてベクトル DB に入れる',
      actions: [
        { type: 'travel', particle: 'v', edges: ['e-docs-chunk'], payload: { kind: 'text', label: '文書' } },
        { type: 'travel', particle: 'v', edges: ['e-chunk-embed'], payload: { kind: 'chunks', label: '文書×3', count: 3 } },
        { type: 'travel', particle: 'v', edges: ['e-embed-db'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'v', mode: 'absorb' },
      ],
    },
    {
      n: 2,
      short: 'グラフ側',
      caption: '同じ文書から LLM で「主語・関係・目的語」の三つ組を抜き、知識グラフを組む',
      actions: [
        { type: 'travel', particle: 'g', edges: ['e-docs-extract'], payload: { kind: 'text', label: '文書' } },
        { type: 'dwell', particle: 'g', node: 'extract', seconds: 0.7, label: '抽出中' },
        { type: 'travel', particle: 'g', edges: ['e-extract-graph'], payload: { kind: 'graph', label: '三つ組' } },
        { type: 'end', particle: 'g', mode: 'absorb' },
      ],
    },
    {
      n: 3,
      short: 'ベクトル検索',
      caption: '質問でベクトル DB を検索し、近いチャンクを上位数件取り出す',
      actions: [
        { type: 'travel', particle: 'q1', edges: ['e-user-vsearch'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'r1', edges: ['e-db-vsearch'], payload: { kind: 'chunks', label: '近い 4 件', count: 3 } },
        { type: 'merge', particles: ['q1', 'r1'], at: 'vsearch', into: { particle: 'c1', payload: { kind: 'chunks', label: '文脈 1', count: 3 } } },
      ],
    },
    {
      n: 4,
      short: 'グラフ検索',
      caption: '質問に出てくる語から、知識グラフの深さ 1 の部分グラフを取り出す',
      actions: [
        { type: 'travel', particle: 'q2', edges: ['e-user-gsearch'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'r2', edges: ['e-graph-gsearch'], payload: { kind: 'graph', label: '部分グラフ' } },
        { type: 'merge', particles: ['q2', 'r2'], at: 'gsearch', into: { particle: 'c2', payload: { kind: 'graph', label: '文脈 2' } } },
      ],
    },
    {
      n: 5,
      short: '連結',
      caption: '2 種類の文脈を、ベクトル検索の結果を先、グラフの結果を後にして 1 つにつなぐ',
      actions: [
        { type: 'travel', particle: 'c1', edges: ['e-vsearch-concat'], payload: { kind: 'chunks', label: '文脈 1', count: 3 } },
        { type: 'travel', particle: 'c2', edges: ['e-gsearch-concat'], payload: { kind: 'graph', label: '文脈 2' } },
        { type: 'merge', particles: ['c1', 'c2'], at: 'concat', into: { particle: 'p', payload: { kind: 'prompt', label: 'プロンプト' } } },
      ],
    },
    {
      n: 6,
      short: '生成',
      caption: 'LLM が 1 回で回答を書く',
      actions: [
        { type: 'travel', particle: 'p', edges: ['e-concat-llm'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 150, laneGap: 56 },
  sources: [
    {
      title: 'HybridRAG: Integrating Knowledge Graphs and Vector Retrieval Augmented Generation for Efficient Information Extraction',
      authors: 'Sarmah, B. ほか（BlackRock / NVIDIA）',
      year: 2024,
      venue: 'ICAIF 2024',
      arxiv: '2408.04948',
      note: '連結の順（ベクトルを先、グラフを後）と深さ 1 の部分グラフは論文の 3 節による。密＋疎の「ハイブリッド検索」は別の手法',
    },
  ],
};
