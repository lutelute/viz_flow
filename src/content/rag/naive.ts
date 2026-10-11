import type { Diagram } from '../../model/diagram';

// 基本の RAG。索引づくり（オフライン）と質問に答える（オンライン）の 2 レーン。
// 質問とチャンクは同じ埋め込みモデルを通り、ベクトル DB が返すのは回答ではなくチャンク。

export const naiveRag: Diagram = {
  id: 'naive-rag',
  title: '基本の RAG',
  subtitle: '文書を先にベクトルにしておき、質問に近い文書を添えて答えさせる',
  lanes: [
    { id: 'index', label: '索引づくり（あらかじめ）', tone: 'accent1', frame: 'band' },
    { id: 'query', label: '質問に答える（そのつど）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書群', sublabel: 'PDF や社内資料', lane: 'index', col: 0 },
    { id: 'chunker', kind: 'chunker', label: 'チャンク\n分割', lane: 'index', col: 1 },
    { id: 'embed', kind: 'embedding', label: '埋め込み\nモデル', sublabel: '文をベクトルにする', lane: 'index', col: 2 },
    { id: 'vecdb', kind: 'vectordb', label: 'ベクトル DB', sublabel: '近いものを探せる', lane: 'index', col: 3 },
    { id: 'user', kind: 'user', label: '質問', lane: 'query', col: 0 },
    { id: 'prompt', kind: 'prompt', label: 'プロンプト\nテンプレート', lane: 'query', col: 1 },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '文章を生成する', lane: 'query', col: 2 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'query', col: 3 },
  ],
  edges: [
    { id: 'e-docs-chunk', from: 'docs', to: 'chunker' },
    { id: 'e-chunk-embed', from: 'chunker', to: 'embed' },
    { id: 'e-embed-db', from: 'embed', to: 'vecdb' },
    { id: 'e-user-embed', from: 'user', to: 'embed', label: '同じモデルで', fromSide: 'top', toSide: 'bottom', role: 'ref' },
    { id: 'e-db-prompt', from: 'vecdb', to: 'prompt', label: '近い K 件', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-prompt', from: 'user', to: 'prompt' },
    { id: 'e-prompt-llm', from: 'prompt', to: 'llm' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '分割',
      caption: '文書を数百字ほどの塊（チャンク）に分ける',
      actions: [{ type: 'travel', particle: 'doc', edges: ['e-docs-chunk'], payload: { kind: 'text', label: '文書' } }],
    },
    {
      n: 2,
      short: 'ベクトル化',
      caption: 'チャンクを埋め込みモデルに通し、意味を表す数の並び（ベクトル）にする',
      actions: [{ type: 'travel', particle: 'doc', edges: ['e-chunk-embed'], payload: { kind: 'chunks', label: '文書×3', count: 3 } }],
    },
    {
      n: 3,
      short: '保存',
      caption: 'ベクトルと元の文をベクトル DB にしまう。ここまでは質問が来る前に済ませる',
      actions: [
        { type: 'travel', particle: 'doc', edges: ['e-embed-db'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'doc', mode: 'absorb' },
      ],
    },
    {
      n: 4,
      short: '質問も',
      caption: '質問を、文書と同じ埋め込みモデルでベクトルにする',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-embed'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'q2', edges: ['e-user-prompt'], payload: { kind: 'query', label: '質問' } },
      ],
    },
    {
      n: 5,
      short: '検索',
      caption: 'ベクトル DB で質問に近いチャンクを上位 K 件取り出す。返ってくるのは文書で、答えではない',
      badge: { edge: 'e-db-prompt', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-embed-db'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'travel', particle: 'q', edges: ['e-db-prompt'], payload: { kind: 'chunks', label: '上位 3 件', count: 3 } },
      ],
    },
    {
      n: 6,
      short: '差し込み',
      caption: '質問と取り出したチャンクをテンプレートに差し込み、1 つのプロンプトにする',
      actions: [{ type: 'merge', particles: ['q', 'q2'], at: 'prompt', into: { particle: 'p', payload: { kind: 'prompt', label: 'プロンプト' } } }],
    },
    {
      n: 7,
      short: '生成',
      caption: 'LLM がプロンプトを読み、チャンクを根拠に回答を書く',
      actions: [
        { type: 'travel', particle: 'p', edges: ['e-prompt-llm'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
      authors: 'Lewis, P. ほか',
      year: 2020,
      venue: 'NeurIPS 2020',
      arxiv: '2005.11401',
      note: '検索器と生成器を組み合わせる原型。図の下レーンが論文の Figure 1 に対応する',
    },
    {
      title: 'Retrieval-Augmented Generation for Large Language Models: A Survey',
      authors: 'Gao, Y. ほか',
      year: 2023,
      arxiv: '2312.10997',
      note: '「Naive RAG」の呼び名と、索引づくり・検索・生成の 3 段の整理はこの survey による',
    },
  ],
};
