import type { Diagram } from '../../model/diagram';

// Speculative RAG。小型の下書き器が文書の部分集合ごとに並列で下書きを書き、
// 大型の検証器は長い文脈を読まずに 1 回の順伝播で採点して、最高点の下書きをそのまま答えにする。

export const speculativeRag: Diagram = {
  id: 'speculative-rag',
  title: 'Speculative RAG',
  subtitle: '小型モデルが下書きを何本も書き、大型モデルは採点だけする',
  lanes: [
    { id: 'draft', label: '小型モデルが並列に下書き', tone: 'accent2', frame: 'band' },
    { id: 'verify', label: '大型モデルが採点して選ぶ', tone: 'accent1', frame: 'band' },
  ],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'draft', col: 0, row: 1 },
    { id: 'ret', kind: 'retriever', label: '検索', sublabel: '上位 n 件', lane: 'draft', col: 1, row: 1, emphasis: 'muted' },
    { id: 'cluster', kind: 'chunker', label: 'クラスタで\n部分集合に', sublabel: '各クラスタから 1 本ずつ', lane: 'draft', col: 2, row: 1, emphasis: 'new' },
    { id: 'd1', kind: 'llm', label: '下書き器 1', sublabel: '小型。下書きと根拠', lane: 'draft', col: 3, row: 0, emphasis: 'new', opens: 'inside-llm' },
    { id: 'd2', kind: 'llm', label: '下書き器 2', lane: 'draft', col: 3, row: 1, emphasis: 'new', opens: 'inside-llm' },
    { id: 'd3', kind: 'llm', label: '下書き器 3', lane: 'draft', col: 3, row: 2, emphasis: 'new', opens: 'inside-llm' },
    { id: 'verifier', kind: 'grader', label: '検証器', sublabel: '大型。1 回の順伝播で採点', lane: 'verify', col: 3, emphasis: 'new' },
    { id: 'answer', kind: 'answer', label: '回答', sublabel: '最高点の下書きそのもの', lane: 'verify', col: 2 },
  ],
  edges: [
    { id: 'e-user-ret', from: 'user', to: 'ret' },
    { id: 'e-ret-cluster', from: 'ret', to: 'cluster' },
    { id: 'e-c-d1', from: 'cluster', to: 'd1', role: 'branch', branch: { group: 'd', option: '1' } },
    { id: 'e-c-d2', from: 'cluster', to: 'd2', role: 'branch', branch: { group: 'd', option: '2' } },
    { id: 'e-c-d3', from: 'cluster', to: 'd3', role: 'branch', branch: { group: 'd', option: '3' } },
    { id: 'e-d1-v', from: 'd1', to: 'verifier', fromSide: 'right', toSide: 'right' },
    { id: 'e-d2-v', from: 'd2', to: 'verifier', fromSide: 'right', toSide: 'right' },
    { id: 'e-d3-v', from: 'd3', to: 'verifier', fromSide: 'right', toSide: 'right' },
    { id: 'e-v-answer', from: 'verifier', to: 'answer', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '検索',
      caption: '質問で検索し、上位 n 件の文書を取る',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-ret'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'q', edges: ['e-ret-cluster'], payload: { kind: 'chunks', label: '文書×n', count: 3 } },
      ],
    },
    {
      n: 2,
      short: '部分集合',
      caption: '文書をクラスタに分け、各クラスタから 1 本ずつ抜いて視点の違う部分集合を作る',
      actions: [
        { type: 'dwell', particle: 'q', node: 'cluster', seconds: 0.7, label: '分割中' },
        {
          type: 'split',
          particle: 'q',
          at: 'cluster',
          into: [
            { particle: 's1', payload: { kind: 'chunks', label: '集合 1', count: 3 } },
            { particle: 's2', payload: { kind: 'chunks', label: '集合 2', count: 3 } },
            { particle: 's3', payload: { kind: 'chunks', label: '集合 3', count: 3 } },
          ],
        },
        { type: 'travel', particle: 's1', edges: ['e-c-d1'], payload: { kind: 'chunks', label: '集合 1', count: 3 } },
        { type: 'travel', particle: 's2', edges: ['e-c-d2'], payload: { kind: 'chunks', label: '集合 2', count: 3 } },
        { type: 'travel', particle: 's3', edges: ['e-c-d3'], payload: { kind: 'chunks', label: '集合 3', count: 3 } },
      ],
    },
    {
      n: 3,
      short: '下書き',
      caption: '小型の下書き器が部分集合ごとに並列で、下書きとその根拠を書く',
      actions: [
        { type: 'dwell', particle: 's1', node: 'd1', seconds: 0.8, label: '下書き中' },
        { type: 'dwell', particle: 's2', node: 'd2', seconds: 0.8, label: '下書き中' },
        { type: 'dwell', particle: 's3', node: 'd3', seconds: 0.8, label: '下書き中' },
      ],
    },
    {
      n: 4,
      short: '採点',
      caption: '大型の検証器が 1 回の順伝播で、下書きの一貫性と自己反省の点数を出す。長い文脈は読まない',
      actions: [
        { type: 'travel', particle: 's1', edges: ['e-d1-v'], payload: { kind: 'text', label: '下書き 1' } },
        { type: 'travel', particle: 's2', edges: ['e-d2-v'], payload: { kind: 'text', label: '下書き 2' } },
        { type: 'travel', particle: 's3', edges: ['e-d3-v'], payload: { kind: 'text', label: '下書き 3' } },
        { type: 'merge', particles: ['s1', 's2', 's3'], at: 'verifier', into: { particle: 'b', payload: { kind: 'score', label: '点数' } } },
        { type: 'dwell', particle: 'b', node: 'verifier', seconds: 0.7, label: '採点中' },
      ],
    },
    {
      n: 5,
      short: '選ぶ',
      caption: '最高点の下書きをそのまま回答にする。書き直しはしない',
      actions: [
        { type: 'travel', particle: 'b', edges: ['e-v-answer'], payload: { kind: 'answer', label: '最高点' } },
        { type: 'end', particle: 'b', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 140 },
  sources: [
    {
      title: 'Speculative RAG: Enhancing Retrieval Augmented Generation through Drafting',
      authors: 'Wang, Z. ほか（UCSD / Google）',
      year: 2024,
      venue: 'ICLR 2025',
      arxiv: '2407.08223',
      note: '多視点サンプリング、下書き器、検証器の自己一貫性と自己反省の点数は論文の 3 節。token 単位の投機的デコードとは別物',
    },
  ],
};
