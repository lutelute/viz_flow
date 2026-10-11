import type { Diagram } from '../../model/diagram';

// CRAG。別の小型モデル（評価器）が取得文書を採点し、正しい / 誤り / あいまい の 3 つに分ける。
// 訂正されるのは回答ではなく検索結果。Web 検索は常時ではなく保険。

export const correctiveRag: Diagram = {
  id: 'corrective-rag',
  title: 'CRAG（訂正つき RAG）',
  subtitle: '取り出した文書を小型の評価器が採点し、駄目なら捨てて Web で探し直す',
  lanes: [
    { id: 'retrieve', label: '検索して採点する', tone: 'accent1', frame: 'band' },
    { id: 'correct', label: '判定に応じて訂正し、答える', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'retrieve', col: 0 },
    { id: 'ret', kind: 'retriever', label: '検索', lane: 'retrieve', col: 1, emphasis: 'muted' },
    { id: 'docs', kind: 'documents', label: '取得文書', sublabel: '約 10 件', lane: 'retrieve', col: 2, emphasis: 'muted' },
    { id: 'eval', kind: 'grader', label: '評価器', sublabel: '小型の T5。LLM とは別', lane: 'retrieve', col: 3, emphasis: 'new' },
    { id: 'judge', kind: 'router', label: '判定', sublabel: '正しい / 誤り / あいまい', lane: 'correct', col: 3, emphasis: 'new' },
    { id: 'refine', kind: 'chunker', label: '知識の精錬', sublabel: '短冊に分けて選別し、組み直す', lane: 'correct', col: 2, row: 0, emphasis: 'new' },
    { id: 'web', kind: 'web', label: 'Web 検索', sublabel: '質問をキーワードに書き換えて', lane: 'correct', col: 2, row: 1, emphasis: 'new' },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'correct', col: 1 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'correct', col: 0 },
  ],
  edges: [
    { id: 'e-user-ret', from: 'user', to: 'ret' },
    { id: 'e-ret-docs', from: 'ret', to: 'docs' },
    { id: 'e-docs-eval', from: 'docs', to: 'eval' },
    { id: 'e-eval-judge', from: 'eval', to: 'judge', label: '点数' },
    { id: 'e-j-refine', from: 'judge', to: 'refine', label: '正しい', labelAt: 0.5, role: 'branch', branch: { group: 'j', option: 'ok' }, fromSide: 'left', toSide: 'right', tone: 'ok' },
    { id: 'e-j-web', from: 'judge', to: 'web', label: '誤り', labelAt: 0.72, role: 'branch', branch: { group: 'j', option: 'ng' }, fromSide: 'left', toSide: 'right', tone: 'ng' },
    { id: 'e-refine-llm', from: 'refine', to: 'llm', fromSide: 'left', toSide: 'right' },
    { id: 'e-web-llm', from: 'web', to: 'llm', fromSide: 'left', toSide: 'right' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '検索',
      caption: '質問で検索し、文書を約 10 件取り出す',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-ret'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'q', edges: ['e-ret-docs'], payload: { kind: 'chunks', label: '約 10 件', count: 3 } },
      ],
    },
    {
      n: 2,
      short: '採点',
      caption: '評価器が文書を 1 件ずつ採点する。評価器は LLM ではなく、別に学習した小型モデル',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-docs-eval'], payload: { kind: 'chunks', label: '文書', count: 3 } },
        { type: 'dwell', particle: 'q', node: 'eval', seconds: 0.8, label: '採点中' },
      ],
    },
    {
      n: 3,
      short: '3 つに判定',
      caption: '点数から「正しい」「誤り」「あいまい」のどれかに判定する',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-eval-judge'], payload: { kind: 'score', label: '点数' } },
        {
          type: 'split',
          particle: 'q',
          at: 'judge',
          into: [
            { particle: 'ok', payload: { kind: 'chunks', label: '正しい', tone: 'ok', count: 3 } },
            { particle: 'ng', payload: { kind: 'query', label: '誤り', tone: 'ng' } },
            { particle: 'amb1', payload: { kind: 'chunks', label: 'あいまい', tone: 'warn', count: 3 } },
            { particle: 'amb2', payload: { kind: 'query', label: 'あいまい', tone: 'warn' } },
          ],
        },
      ],
    },
    {
      n: 4,
      short: '正しい',
      caption: '正しいなら、文書を短冊に分けて関係ある部分だけ残し、元の順に組み直す',
      actions: [
        { type: 'travel', particle: 'ok', edges: ['e-j-refine'], payload: { kind: 'chunks', label: '正しい', tone: 'ok', count: 3 } },
        { type: 'travel', particle: 'amb1', edges: ['e-j-refine'], payload: { kind: 'chunks', label: 'あいまい', tone: 'warn', count: 3 } },
        { type: 'dwell', particle: 'ok', node: 'refine', seconds: 0.8, label: '精錬中' },
      ],
    },
    {
      n: 5,
      short: '誤り',
      caption: '誤りなら検索結果を捨て、質問をキーワードに書き換えて Web を検索する。あいまいなら両方やる',
      actions: [
        { type: 'travel', particle: 'ng', edges: ['e-j-web'], payload: { kind: 'query', label: '誤り', tone: 'ng' } },
        { type: 'travel', particle: 'amb2', edges: ['e-j-web'], payload: { kind: 'query', label: 'あいまい', tone: 'warn' } },
        { type: 'dwell', particle: 'ng', node: 'web', seconds: 0.8, label: '検索中' },
      ],
    },
    {
      n: 6,
      short: '合流',
      caption: '精錬した知識と Web で得た知識を LLM に渡す',
      actions: [
        { type: 'travel', particle: 'ok', edges: ['e-refine-llm'], payload: { kind: 'chunks', label: '精錬した知識', tone: 'ok', count: 3 } },
        { type: 'travel', particle: 'amb1', edges: ['e-refine-llm'], payload: { kind: 'chunks', label: '精錬した知識', tone: 'warn', count: 3 } },
        { type: 'travel', particle: 'ng', edges: ['e-web-llm'], payload: { kind: 'chunks', label: 'Web の知識', tone: 'ng', count: 3 } },
        { type: 'travel', particle: 'amb2', edges: ['e-web-llm'], payload: { kind: 'chunks', label: 'Web の知識', tone: 'warn', count: 3 } },
        { type: 'merge', particles: ['ok', 'amb1', 'ng', 'amb2'], at: 'llm', into: { particle: 'p', payload: { kind: 'prompt', label: 'プロンプト' } } },
      ],
    },
    {
      n: 7,
      short: '生成',
      caption: 'LLM が訂正済みの知識を根拠に回答を書く',
      actions: [
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'Corrective Retrieval Augmented Generation',
      authors: 'Yan, S., Gu, J., Zhu, Y., Ling, Z.',
      year: 2024,
      arxiv: '2401.15884',
      note: '評価器は fine-tune した T5-large。3 値の判定、分解と再構成、Web 検索の順は論文の Figure 2 に対応する',
    },
  ],
};
