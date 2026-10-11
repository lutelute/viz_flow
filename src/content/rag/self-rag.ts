import type { Diagram } from '../../model/diagram';

// Self-RAG。生成器自身が語彙に埋め込まれた特殊トークンで「検索するか」を決め、自分の続きを批評する。
// 外部の評価器は置かない。CRAG（外部の小型評価器）との違いはここ。

export const selfRag: Diagram = {
  id: 'self-rag',
  title: 'Self-RAG',
  subtitle: '生成器が特殊トークンで「検索するか」を自分で決め、自分の続きを自分で批評する',
  lanes: [
    { id: 'gen', label: '生成器が区切りごとに自分で決める', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'gen', col: 0, row: 0 },
    { id: 'gen', kind: 'llm', label: '生成器', sublabel: '特殊トークンも学習済み', lane: 'gen', col: 1, row: 0, emphasis: 'new' },
    { id: 'retrieveq', kind: 'router', label: '検索する？', sublabel: 'Retrieve トークン', lane: 'gen', col: 2, row: 0, emphasis: 'new' },
    { id: 'ret', kind: 'retriever', label: '検索', sublabel: 'K 件', lane: 'gen', col: 3, row: 0, emphasis: 'muted' },
    { id: 'drafts', kind: 'chunker', label: '続きを\n並列に生成', sublabel: '文書ごとに 1 案', lane: 'gen', col: 3, row: 1, emphasis: 'new' },
    { id: 'critic', kind: 'grader', label: '自己批評', sublabel: 'IsRel / IsSup / IsUse', lane: 'gen', col: 2, row: 1, emphasis: 'new' },
    { id: 'beam', kind: 'reranker', label: '最良を選ぶ', sublabel: '生成確率と批評の重み和', lane: 'gen', col: 1, row: 1, emphasis: 'new' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'gen', col: 0, row: 1 },
  ],
  edges: [
    { id: 'e-user-gen', from: 'user', to: 'gen' },
    { id: 'e-gen-rq', from: 'gen', to: 'retrieveq' },
    { id: 'e-rq-ret', from: 'retrieveq', to: 'ret', label: 'yes', role: 'branch', branch: { group: 'r', option: 'yes' }, tone: 'ok' },
    { id: 'e-rq-beam', from: 'retrieveq', to: 'beam', label: 'no: そのまま続きを書く', role: 'branch', branch: { group: 'r', option: 'no' }, fromSide: 'bottom', toSide: 'top', tone: 'muted', line: 'dashed' },
    { id: 'e-ret-drafts', from: 'ret', to: 'drafts' },
    { id: 'e-drafts-critic', from: 'drafts', to: 'critic', fromSide: 'left', toSide: 'right' },
    { id: 'e-critic-beam', from: 'critic', to: 'beam', fromSide: 'left', toSide: 'right' },
    { id: 'e-beam-gen', from: 'beam', to: 'gen', role: 'loop', label: '次の区切りへ', fromSide: 'top', toSide: 'bottom' },
    { id: 'e-beam-answer', from: 'beam', to: 'answer', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '検索する？',
      caption: '生成器が Retrieve トークンを出し、この区切りで検索が要るかを自分で決める',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-gen'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'gen', seconds: 0.6, label: '判断中' },
        { type: 'travel', particle: 'q', edges: ['e-gen-rq'], payload: { kind: 'plan', label: 'Retrieve?' } },
        { type: 'highlight', edges: ['e-rq-beam'] },
      ],
    },
    {
      n: 2,
      short: '取得',
      caption: 'yes なら文書を K 件取る。no ならそのまま続きを書く',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-rq-ret'], payload: { kind: 'query', label: 'yes', tone: 'ok' } },
        { type: 'travel', particle: 'q', edges: ['e-ret-drafts'], payload: { kind: 'chunks', label: '文書×3', count: 3 } },
      ],
    },
    {
      n: 3,
      short: '並列に書く',
      caption: '文書ごとに続きの候補を並列に生成する',
      actions: [
        { type: 'dwell', particle: 'q', node: 'drafts', seconds: 0.8, label: '生成中' },
        {
          type: 'split',
          particle: 'q',
          at: 'drafts',
          into: [
            { particle: 'c1', payload: { kind: 'text', label: '案 1' } },
            { particle: 'c2', payload: { kind: 'text', label: '案 2' } },
            { particle: 'c3', payload: { kind: 'text', label: '案 3' } },
          ],
        },
        { type: 'travel', particle: 'c1', edges: ['e-drafts-critic'], payload: { kind: 'text', label: '案 1' } },
        { type: 'travel', particle: 'c2', edges: ['e-drafts-critic'], payload: { kind: 'text', label: '案 2' } },
        { type: 'travel', particle: 'c3', edges: ['e-drafts-critic'], payload: { kind: 'text', label: '案 3' } },
      ],
    },
    {
      n: 4,
      short: '自己批評',
      caption: '各候補に「文書は関係あるか」「文書に裏付けられているか」「役に立つか」の批評トークンを自分で付ける',
      actions: [
        { type: 'dwell', particle: 'c1', node: 'critic', seconds: 0.8, label: '批評中' },
        { type: 'merge', particles: ['c1', 'c2', 'c3'], at: 'critic', into: { particle: 's', payload: { kind: 'score', label: '批評つき' } } },
      ],
    },
    {
      n: 5,
      short: '選ぶ',
      caption: '生成確率と批評の重み付き和で、最良の続きを選ぶ',
      actions: [
        { type: 'travel', particle: 's', edges: ['e-critic-beam'], payload: { kind: 'score', label: '批評つき' } },
        { type: 'dwell', particle: 's', node: 'beam', seconds: 0.6, label: '選択中' },
      ],
    },
    {
      n: 6,
      short: '次の区切り',
      caption: '選んだ続きを足して次の区切りへ戻り、①から繰り返す。終われば回答になる',
      actions: [
        { type: 'travel', particle: 's', edges: ['e-beam-gen'], payload: { kind: 'text', label: '続き' } },
        { type: 'dwell', particle: 's', node: 'gen', seconds: 0.5, label: '2 回目' },
        { type: 'travel', particle: 's', edges: ['e-gen-rq'], payload: { kind: 'plan', label: 'Retrieve?' } },
        { type: 'travel', particle: 's', edges: ['e-rq-beam'], payload: { kind: 'text', label: 'no', tone: 'muted' } },
        { type: 'travel', particle: 's', edges: ['e-beam-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 's', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 160 },
  sources: [
    {
      title: 'Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection',
      authors: 'Asai, A., Wu, Z., Wang, Y., Sil, A., Hajishirzi, H.',
      year: 2023,
      venue: 'ICLR 2024 oral',
      arxiv: '2310.11511',
      note: 'Retrieve / IsRel / IsSup / IsUse の 4 種の反省トークン（Table 1）と区切りごとのビーム探索（Algorithm 1）に対応する',
    },
  ],
};
