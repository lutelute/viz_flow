import type { Diagram } from '../../model/diagram';

// IRCoT。推論文を 1 文書くたびに、その文を検索語にして取り直す交互ループ。
// 多段の質問（A を知るには B が要る）に効く。Adaptive-RAG の C 経路の中身でもある。

export const ircot: Diagram = {
  id: 'ircot',
  title: 'IRCoT（推論と検索を交互に）',
  subtitle: '推論文を 1 文書いては、その文で検索し直す。答えに届くまで繰り返す',
  lanes: [{ id: 'loop', label: '1 文書くごとに検索し直す', tone: 'accent2', frame: 'band' }],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', sublabel: '多段の問い', lane: 'loop', col: 0, row: 0 },
    { id: 'ret', kind: 'retriever', label: '検索', sublabel: '最新の文で', lane: 'loop', col: 1, row: 0 },
    { id: 'docs', kind: 'documents', label: '集めた段落', sublabel: '取り直すたびに増える', lane: 'loop', col: 2, row: 0, emphasis: 'new' },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '推論文を 1 文だけ書く', lane: 'loop', col: 3, row: 0, emphasis: 'new', opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'loop', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-user-ret', from: 'user', to: 'ret' },
    { id: 'e-ret-docs', from: 'ret', to: 'docs' },
    { id: 'e-docs-llm', from: 'docs', to: 'llm' },
    { id: 'e-llm-ret', from: 'llm', to: 'ret', role: 'loop', label: '最新の推論文を検索語に', fromSide: 'top', toSide: 'top' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'right', toSide: 'right' },
  ],
  steps: [
    { n: 1, short: '初回検索', caption: '質問そのもので最初の検索をする', actions: [{ type: 'travel', particle: 'q', edges: ['e-user-ret'], payload: { kind: 'query', label: '質問' } }] },
    { n: 2, short: '蓄積', caption: '取れた段落を手元に積む', actions: [{ type: 'travel', particle: 'q', edges: ['e-ret-docs'], payload: { kind: 'chunks', label: '段落', count: 3 } }] },
    {
      n: 3,
      short: '1 文書く',
      caption: 'LLM が質問と段落を読み、推論の続きを 1 文だけ書く',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-docs-llm'], payload: { kind: 'chunks', label: '段落', count: 3 } },
        { type: 'dwell', particle: 'q', node: 'llm', seconds: 0.7, label: '1 文' },
      ],
    },
    {
      n: 4,
      short: '再検索',
      caption: 'その 1 文を検索語にして取り直す。質問には無かった固有名詞が検索に入る',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-llm-ret'], payload: { kind: 'text', label: '推論文', tone: 'warn' } }],
    },
    {
      n: 5,
      short: '2 周目',
      caption: '新しい段落を足し、次の 1 文を書く。答えが出るか回数の上限まで繰り返す',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-ret-docs'], payload: { kind: 'chunks', label: '段落（増）', count: 3 } },
        { type: 'travel', particle: 'q', edges: ['e-docs-llm'], payload: { kind: 'chunks', label: '段落', count: 3 } },
        { type: 'dwell', particle: 'q', node: 'llm', seconds: 0.7, label: '次の 1 文' },
      ],
    },
    {
      n: 6,
      short: '回答',
      caption: '推論が答えに届いたら、積んだ段落と推論文から回答を書く',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'q', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Interleaving Retrieval with Chain-of-Thought Reasoning for Knowledge-Intensive Multi-Step Questions',
      authors: 'Trivedi, H., Balasubramanian, N., Khot, T., Sabharwal, A.',
      year: 2023,
      venue: 'ACL 2023',
      arxiv: '2212.10509',
      note: '「CoT の最後の文を次の検索語にする」交互ループは論文の 3 節。Adaptive-RAG の多段経路に使われている',
    },
  ],
};
