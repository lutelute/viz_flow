import type { Diagram } from '../../model/diagram';

// HyDE。質問そのものではなく「答えらしい仮の文書」を書かせて埋め込み、文書どうしの近さで探す。
// 仮の文書は検索にだけ使い、回答には使わない。

export const hydeRag: Diagram = {
  id: 'hyde-rag',
  title: 'HyDE',
  subtitle: '質問の代わりに「答えらしい仮の文書」を書かせ、それで本物の文書を探す',
  lanes: [
    { id: 'index', label: '索引づくり（あらかじめ）', tone: 'accent1', frame: 'band' },
    { id: 'query', label: '質問に答える（そのつど）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書群', lane: 'index', col: 0, emphasis: 'muted' },
    { id: 'chunker', kind: 'chunker', label: 'チャンク\n分割', lane: 'index', col: 1, emphasis: 'muted' },
    { id: 'enc', kind: 'encoder', label: 'エンコーダ', sublabel: '文書も仮の文書も', lane: 'index', col: 2 },
    { id: 'vecdb', kind: 'vectordb', label: 'ベクトル DB', lane: 'index', col: 3, emphasis: 'muted' },
    { id: 'user', kind: 'user', label: '質問', lane: 'query', col: 0 },
    { id: 'draft', kind: 'llm', label: 'LLM', sublabel: '答えらしい文を書く', lane: 'query', col: 1, emphasis: 'new' },
    { id: 'prompt', kind: 'prompt', label: 'プロンプト\nテンプレート', lane: 'query', col: 2 },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'query', col: 3 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'query', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-docs-chunk', from: 'docs', to: 'chunker' },
    { id: 'e-chunk-enc', from: 'chunker', to: 'enc' },
    { id: 'e-enc-db', from: 'enc', to: 'vecdb' },
    { id: 'e-user-draft', from: 'user', to: 'draft' },
    { id: 'e-draft-enc', from: 'draft', to: 'enc', fromSide: 'top', toSide: 'bottom' },
    { id: 'e-db-prompt', from: 'vecdb', to: 'prompt', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-prompt-llm', from: 'prompt', to: 'llm' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '索引',
      caption: '文書はあらかじめチャンクに分け、エンコーダでベクトルにして DB に入れておく',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-docs-chunk'], payload: { kind: 'text', label: '文書' } },
        { type: 'travel', particle: 'd', edges: ['e-chunk-enc'], payload: { kind: 'chunks', label: '文書×3', count: 3 } },
        { type: 'travel', particle: 'd', edges: ['e-enc-db'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'd', mode: 'absorb' },
      ],
    },
    {
      n: 2,
      short: '下書き',
      caption: '質問を LLM に渡し、答えらしい文章（仮の文書）を書かせる。内容が間違っていてもよい',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-draft'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'draft', seconds: 0.8, label: '生成中' },
      ],
    },
    {
      n: 3,
      short: 'ベクトル化',
      caption: '仮の文書を、索引と同じエンコーダでベクトルにする',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-draft-enc'], payload: { kind: 'text', label: '仮の文書', ghost: true } }],
    },
    {
      n: 4,
      short: '検索',
      caption: '「質問と文書」ではなく「文書と文書」の近さで、ベクトル DB を探す',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-enc-db'], payload: { kind: 'vector', label: 'ベクトル' } }],
    },
    {
      n: 5,
      short: '本物だけ',
      caption: '仮の文書は捨て、見つかった本物のチャンクを上位 K 件取り出す',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-db-prompt'], payload: { kind: 'chunks', label: '本物 3 件', count: 3 } }],
    },
    {
      n: 6,
      short: '生成',
      caption: '本物のチャンクと質問をプロンプトにして、LLM が回答を書く',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-prompt-llm'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'dwell', particle: 'q', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'q', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'q', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Precise Zero-Shot Dense Retrieval without Relevance Labels',
      authors: 'Gao, L., Ma, X., Lin, J., Callan, J.',
      year: 2022,
      venue: 'ACL 2023',
      arxiv: '2212.10496',
      note: '仮の文書を N 本書いて平均する（式 7）。図はその 1 本ぶんを描いている。生成段は HyDE の範囲外',
    },
  ],
};
