import type { Diagram } from '../../model/diagram';

// マルチモーダル RAG（共有埋め込み空間の方式）。画像と文を別々のエンコーダで同じ空間のベクトルにし、
// 1 つの索引から種類をまたいで探す。生成器は画像を読めるマルチモーダル LLM。

export const multimodalRag: Diagram = {
  id: 'multimodal-rag',
  title: 'マルチモーダル RAG',
  subtitle: '画像も文も同じ空間のベクトルにして 1 つの索引に入れ、種類をまたいで探す',
  lanes: [
    { id: 'index', label: '索引づくり（あらかじめ）', tone: 'accent1', frame: 'band' },
    { id: 'query', label: '質問に答える（そのつど）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'imgs', kind: 'documents', label: '画像・図表', lane: 'index', col: 0, row: 0, emphasis: 'new' },
    { id: 'txts', kind: 'documents', label: 'テキスト', lane: 'index', col: 0, row: 1 },
    { id: 'imgenc', kind: 'encoder', label: '画像\nエンコーダ', lane: 'index', col: 1, row: 0, emphasis: 'new' },
    { id: 'txtenc', kind: 'encoder', label: 'テキスト\nエンコーダ', lane: 'index', col: 1, row: 1 },
    { id: 'index', kind: 'index', label: '共通の索引', sublabel: '2 塔を同じ空間に揃える', lane: 'index', col: 2, emphasis: 'new' },
    { id: 'user', kind: 'user', label: '質問', sublabel: '文でも画像でも', lane: 'query', col: 0 },
    { id: 'fusion', kind: 'prompt', label: '統合', sublabel: '画像と文を 1 つに', lane: 'query', col: 2, emphasis: 'new' },
    { id: 'mllm', kind: 'llm', label: 'マルチ\nモーダル LLM', sublabel: '画像を読める', lane: 'query', col: 3, emphasis: 'new' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'query', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-img-enc', from: 'imgs', to: 'imgenc' },
    { id: 'e-txt-enc', from: 'txts', to: 'txtenc' },
    { id: 'e-imgenc-idx', from: 'imgenc', to: 'index' },
    { id: 'e-txtenc-idx', from: 'txtenc', to: 'index' },
    { id: 'e-user-txtenc', from: 'user', to: 'txtenc', label: '対応するエンコーダで', fromSide: 'top', toSide: 'bottom', role: 'ref' },
    { id: 'e-idx-fusion', from: 'index', to: 'fusion', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-fusion-mllm', from: 'fusion', to: 'mllm' },
    { id: 'e-mllm-answer', from: 'mllm', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '2 塔',
      caption: '画像は画像エンコーダ、文はテキストエンコーダに通す。2 つは同じ空間に揃えて学習してある',
      actions: [
        { type: 'travel', particle: 'i', edges: ['e-img-enc'], payload: { kind: 'image', label: '画像' } },
        { type: 'travel', particle: 't', edges: ['e-txt-enc'], payload: { kind: 'text', label: '文' } },
      ],
    },
    {
      n: 2,
      short: '1 つの索引',
      caption: '画像のベクトルも文のベクトルも、同じ 1 つの索引に入れる',
      actions: [
        { type: 'travel', particle: 'i', edges: ['e-imgenc-idx'], payload: { kind: 'vector', label: 'ベクトル', tone: 'accent3' } },
        { type: 'travel', particle: 't', edges: ['e-txtenc-idx'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'i', mode: 'absorb' },
        { type: 'end', particle: 't', mode: 'absorb' },
      ],
    },
    {
      n: 3,
      short: '質問も',
      caption: '質問を、その種類に対応するエンコーダでベクトルにする',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-user-txtenc'], payload: { kind: 'query', label: '質問' } }],
    },
    {
      n: 4,
      short: '横断検索',
      caption: '画像も文も混ぜたまま、質問に近いものを探す',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-txtenc-idx'], payload: { kind: 'vector', label: 'ベクトル' } }],
    },
    {
      n: 5,
      short: '統合',
      caption: '見つかった画像と文を 1 つのプロンプトに統合する',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-idx-fusion'], payload: { kind: 'chunks', label: '画像と文', count: 3 } }],
    },
    {
      n: 6,
      short: '生成',
      caption: '画像を読めるマルチモーダル LLM が回答を書く。文しか読めない LLM では足りない',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-fusion-mllm'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'dwell', particle: 'q', node: 'mllm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'q', edges: ['e-mllm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'q', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 150, laneGap: 56 },
  sources: [
    {
      title: 'Ask in Any Modality: A Comprehensive Survey on Multimodal Retrieval-Augmented Generation',
      authors: 'Abootorabi, M. M. ほか',
      year: 2025,
      venue: 'Findings of ACL 2025',
      arxiv: '2502.08826',
      note: '検索・統合・生成の段分けはこの survey の整理による。図は共有埋め込み空間の方式',
    },
    {
      title: 'Learning Transferable Visual Models From Natural Language Supervision',
      authors: 'Radford, A. ほか',
      year: 2021,
      venue: 'ICML 2021',
      arxiv: '2103.00020',
      note: '画像とテキストの 2 塔を対照学習で同じ空間に揃える（CLIP）',
    },
  ],
};
