import type { Composition, Diagram } from '../../model/diagram';

// RAG と REFRAG のデコードの違い。検索は同じで、変わるのはデコーダへの「入れ方」。
// 通常は取得文書を全部トークンにして読ませる。REFRAG は 16 トークンごとに 1 ベクトルに圧縮し、
// RL ポリシーが選んだ塊だけトークンに戻す。

export const ragDecode: Diagram = {
  id: 'rag-decode',
  title: '通常の RAG のデコード',
  lanes: [{ id: 'decode', label: '取得した文書を読ませる', tone: 'muted', frame: 'band' }],
  nodes: [
    { id: 'docs', kind: 'documents', label: '取得文書', sublabel: '検索は同じ', lane: 'decode', col: 0 },
    { id: 'tok', kind: 'chunker', label: '全部\nトークンに', sublabel: '長い列になる', lane: 'decode', col: 1 },
    { id: 'dec', kind: 'llm', label: 'デコーダ', sublabel: '全トークンに注意を払う', lane: 'decode', col: 2 },
    { id: 'answer', kind: 'answer', label: '回答', sublabel: '最初の 1 語が遅い', lane: 'decode', col: 3 },
  ],
  edges: [
    { id: 'e-docs-tok', from: 'docs', to: 'tok' },
    { id: 'e-tok-dec', from: 'tok', to: 'dec' },
    { id: 'e-dec-answer', from: 'dec', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: 'トークン化',
      caption: '取得した文書をそのまま全部トークンにする。文書が増えるほど列が長くなる',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-docs-tok'], payload: { kind: 'chunks', label: '文書', count: 3 } }],
    },
    {
      n: 2,
      short: '全部読む',
      caption: 'デコーダは全トークンどうしの注意を計算する。計算量は長さの 2 乗で増える',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-tok-dec'], payload: { kind: 'tokens', label: 'トークン列' } },
        { type: 'dwell', particle: 'd', node: 'dec', seconds: 1.6, label: '計算中' },
      ],
    },
    {
      n: 3,
      short: '最初の 1 語',
      caption: '最初の 1 語が出るまで（TTFT）待たされる',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-dec-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'd', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [],
};

export const refrag: Diagram = {
  id: 'refrag',
  title: 'REFRAG',
  lanes: [{ id: 'decode', label: '塊ごとに圧縮して読ませる', tone: 'accent2', frame: 'band' }],
  nodes: [
    { id: 'docs', kind: 'documents', label: '取得文書', sublabel: '検索は同じ', lane: 'decode', col: 0, row: 0 },
    { id: 'chunk', kind: 'chunker', label: '16 トークン\nの塊に', lane: 'decode', col: 1, row: 0, emphasis: 'new' },
    { id: 'enc', kind: 'encoder', label: '軽量\nエンコーダ', sublabel: 'RoBERTa。1 塊 1 ベクトル', lane: 'decode', col: 2, row: 0, emphasis: 'new' },
    { id: 'proj', kind: 'embedding', label: '射影', sublabel: 'デコーダの空間へ', lane: 'decode', col: 3, row: 0, emphasis: 'new' },
    { id: 'policy', kind: 'policy', label: 'RL ポリシー', sublabel: '戻す塊を選ぶ（約 1 割）', lane: 'decode', col: 3, row: 1, emphasis: 'new' },
    { id: 'mix', kind: 'prompt', label: '混合列', sublabel: 'ベクトルとトークン', lane: 'decode', col: 2, row: 1, emphasis: 'new' },
    { id: 'dec', kind: 'llm', label: 'デコーダ', sublabel: '列が約 1/16 に', lane: 'decode', col: 1, row: 1 },
    { id: 'answer', kind: 'answer', label: '回答', sublabel: '最初の 1 語が速い', lane: 'decode', col: 0, row: 1 },
  ],
  edges: [
    { id: 'e-docs-chunk', from: 'docs', to: 'chunk' },
    { id: 'e-chunk-enc', from: 'chunk', to: 'enc' },
    { id: 'e-enc-proj', from: 'enc', to: 'proj' },
    { id: 'e-proj-policy', from: 'proj', to: 'policy' },
    { id: 'e-policy-mix', from: 'policy', to: 'mix', fromSide: 'left', toSide: 'right' },
    { id: 'e-mix-dec', from: 'mix', to: 'dec', fromSide: 'left', toSide: 'right' },
    { id: 'e-dec-answer', from: 'dec', to: 'answer', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '塊に',
      caption: '取得した文書を 16 トークンずつの塊に切る',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-docs-chunk'], payload: { kind: 'chunks', label: '文書', count: 3 } }],
    },
    {
      n: 2,
      short: '圧縮',
      caption: '軽量エンコーダが 1 塊を 1 つのベクトルにする。塊ごとに独立なので索引時に先に計算しておける',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-chunk-enc'], payload: { kind: 'tokens', label: '16 トークン' } }],
    },
    {
      n: 3,
      short: '射影',
      caption: 'ベクトルをデコーダのトークン埋め込みと同じ空間に射影する',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-enc-proj'], payload: { kind: 'compressed', label: '1 ベクトル' } }],
    },
    {
      n: 4,
      short: '選ぶ',
      caption: 'RL で学習したポリシーが、大事な塊だけを元のトークンに戻す。残りはベクトルのまま',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-proj-policy'], payload: { kind: 'compressed', label: 'ベクトル' } },
        { type: 'dwell', particle: 'd', node: 'policy', seconds: 0.7, label: '選別中' },
      ],
    },
    {
      n: 5,
      short: '混合列',
      caption: '質問のトークンと、圧縮ベクトルと戻したトークンを混ぜた短い列をデコーダに入れる',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-policy-mix'], payload: { kind: 'tokens', label: '混合', tone: 'accent2' } },
        { type: 'travel', particle: 'd', edges: ['e-mix-dec'], payload: { kind: 'tokens', label: '約 1/16', tone: 'accent2' } },
        { type: 'dwell', particle: 'd', node: 'dec', seconds: 0.4, label: '計算中' },
      ],
    },
    {
      n: 6,
      short: '速い',
      caption: '列が短いので最初の 1 語が速く出る（論文では最大 30.85 倍）。検索と精度はほぼそのまま',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-dec-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'd', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'REFRAG: Rethinking RAG based Decoding',
      authors: 'Lin, X., Ghosh, A., Low, B. K. H., Shrivastava, A., Mohan, V.（Meta Superintelligence Labs）',
      year: 2025,
      venue: 'NeurIPS 2025 workshop poster',
      arxiv: '2509.01092',
      note: 'k=16 の塊、RoBERTa エンコーダ、2 層 MLP の射影、GRPO 型の RL ポリシーは論文の 3 節。30.85 倍は k=32 の最良値',
    },
  ],
};

export const ragVsRefrag: Composition = {
  kind: 'stack',
  id: 'rag-vs-refrag',
  title: 'RAG と REFRAG のデコード',
  direction: 'vertical',
  items: [
    { heading: '通常の RAG', diagram: ragDecode },
    { heading: 'REFRAG', diagram: refrag },
  ],
  sync: 'lockstep',
};
