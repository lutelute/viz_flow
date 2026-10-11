import type { Diagram } from '../../model/diagram';

// RAG-Fusion。質問を視点の違う複数の言い換えにし、それぞれで検索して RRF で融合する。
// ハイブリッド検索が「同じ質問に複数の検索器」なのに対し、こちらは「同じ検索器に複数の質問」。

export const ragFusion: Diagram = {
  id: 'rag-fusion',
  title: 'RAG-Fusion',
  subtitle: '質問を言い換えて何本も検索し、順位を融合してから答える',
  lanes: [
    { id: 'expand', label: '言い換えて並列に検索する', tone: 'accent2', frame: 'band' },
    { id: 'answer', label: '融合して答える', tone: 'accent1', frame: 'band' },
  ],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'expand', col: 0, row: 1 },
    { id: 'rewrite', kind: 'llm', label: 'LLM で\n言い換え', sublabel: '視点の違う 3 本', lane: 'expand', col: 1, row: 1, emphasis: 'new', opens: 'inside-llm' },
    { id: 's1', kind: 'retriever', label: '検索 1', lane: 'expand', col: 2, row: 0 },
    { id: 's2', kind: 'retriever', label: '検索 2', lane: 'expand', col: 2, row: 1 },
    { id: 's3', kind: 'retriever', label: '検索 3', lane: 'expand', col: 2, row: 2 },
    { id: 'rrf', kind: 'reranker', label: 'RRF で融合', sublabel: '順位だけを使う', lane: 'expand', col: 3, row: 1, emphasis: 'new', opens: 'inside-rrf' },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'answer', col: 3, opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'answer', col: 2 },
  ],
  edges: [
    { id: 'e-user-rewrite', from: 'user', to: 'rewrite' },
    { id: 'e-rw-s1', from: 'rewrite', to: 's1', role: 'branch', branch: { group: 'q', option: '1' } },
    { id: 'e-rw-s2', from: 'rewrite', to: 's2', role: 'branch', branch: { group: 'q', option: '2' } },
    { id: 'e-rw-s3', from: 'rewrite', to: 's3', role: 'branch', branch: { group: 'q', option: '3' } },
    { id: 'e-s1-rrf', from: 's1', to: 'rrf' },
    { id: 'e-s2-rrf', from: 's2', to: 'rrf' },
    { id: 'e-s3-rrf', from: 's3', to: 'rrf' },
    { id: 'e-rrf-llm', from: 'rrf', to: 'llm', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '言い換え',
      caption: 'LLM が質問を、視点の違う 3 本の言い換えにする',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-rewrite'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'rewrite', seconds: 0.7, label: '言い換え中' },
        {
          type: 'split',
          particle: 'q',
          at: 'rewrite',
          into: [
            { particle: 'q1', payload: { kind: 'query', label: '言い換え 1' } },
            { particle: 'q2', payload: { kind: 'query', label: '言い換え 2' } },
            { particle: 'q3', payload: { kind: 'query', label: '言い換え 3' } },
          ],
        },
      ],
    },
    {
      n: 2,
      short: '並列検索',
      caption: '言い換えごとに同じ検索器で検索し、3 つの順位を得る',
      actions: [
        { type: 'travel', particle: 'q1', edges: ['e-rw-s1'], payload: { kind: 'query', label: '言い換え 1' } },
        { type: 'travel', particle: 'q2', edges: ['e-rw-s2'], payload: { kind: 'query', label: '言い換え 2' } },
        { type: 'travel', particle: 'q3', edges: ['e-rw-s3'], payload: { kind: 'query', label: '言い換え 3' } },
        { type: 'dwell', particle: 'q2', node: 's2', seconds: 0.6, label: '検索中' },
      ],
    },
    {
      n: 3,
      short: '融合',
      caption: '3 つの順位を RRF で 1 つにする。複数の言い換えで上位に来た文書が強くなる',
      actions: [
        { type: 'travel', particle: 'q1', edges: ['e-s1-rrf'], payload: { kind: 'score', label: '順位 1' } },
        { type: 'travel', particle: 'q2', edges: ['e-s2-rrf'], payload: { kind: 'score', label: '順位 2' } },
        { type: 'travel', particle: 'q3', edges: ['e-s3-rrf'], payload: { kind: 'score', label: '順位 3' } },
        { type: 'merge', particles: ['q1', 'q2', 'q3'], at: 'rrf', into: { particle: 'p', payload: { kind: 'chunks', label: '上位 K 件', count: 3 } } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: '融合した上位 K 件と元の質問で LLM が回答を書く。言い換えが脱線すると回答も脱線する',
      actions: [
        { type: 'travel', particle: 'p', edges: ['e-rrf-llm'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 140 },
  sources: [
    {
      title: 'RAG-Fusion: a New Take on Retrieval-Augmented Generation',
      authors: 'Rackauckas, Z.',
      year: 2024,
      venue: 'IJNLC 13(1)',
      arxiv: '2402.03367',
      note: '言い換えの生成と RRF 融合は論文の 2 節。「言い換えが脱線すると回答も脱線する」は著者自身の指摘',
    },
  ],
};
