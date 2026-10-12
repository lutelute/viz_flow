import type { Diagram } from '../../model/diagram';

// Adaptive-RAG（Jeong ほか 2024）。検索の前に小型の分類器が質問の複雑さを見て、
// 「検索なし / 1 回検索 / 多段検索」の 3 つの深さに振り分ける。Web 検索は無い。

export const adaptiveRag: Diagram = {
  id: 'adaptive-rag',
  title: 'Adaptive-RAG',
  subtitle: '質問の複雑さを小型の分類器が見て、検索の深さを 3 段階から選ぶ',
  lanes: [
    { id: 'classify', label: '質問の複雑さを見極める', tone: 'accent1', frame: 'band' },
    { id: 'routes', label: '3 つの深さ（データソースの違いではない）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'classify', col: 0 },
    { id: 'cls', kind: 'grader', label: '複雑さ\n分類器', sublabel: '小型の T5', lane: 'classify', col: 1, emphasis: 'new' },
    { id: 'a', kind: 'router', label: 'A 検索なし', lane: 'routes', col: 2, row: 0, emphasis: 'new' },
    { id: 'b', kind: 'retriever', label: 'B 1 回検索', lane: 'routes', col: 2, row: 1 },
    { id: 'c', kind: 'retriever', label: 'C 多段検索', lane: 'routes', col: 2, row: 2, emphasis: 'new' },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'routes', col: 3, row: 1, opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'routes', col: 3, row: 0 },
  ],
  edges: [
    { id: 'e-user-cls', from: 'user', to: 'cls' },
    { id: 'e-cls-a', from: 'cls', to: 'a', role: 'branch', branch: { group: 'k', option: 'a' }, fromSide: 'bottom', toSide: 'left', tone: 'ok' },
    { id: 'e-cls-b', from: 'cls', to: 'b', role: 'branch', branch: { group: 'k', option: 'b' }, fromSide: 'bottom', toSide: 'left', tone: 'accent1' },
    { id: 'e-cls-c', from: 'cls', to: 'c', role: 'branch', branch: { group: 'k', option: 'c' }, fromSide: 'bottom', toSide: 'left', tone: 'warn' },
    { id: 'e-a-llm', from: 'a', to: 'llm' },
    { id: 'e-b-llm', from: 'b', to: 'llm' },
    { id: 'e-c-llm', from: 'c', to: 'llm' },
    { id: 'e-llm-c', from: 'llm', to: 'c', label: '足りなければもう一度', role: 'loop', fromSide: 'bottom', toSide: 'bottom', tone: 'warn' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'top', toSide: 'bottom' },
  ],
  steps: [
    {
      n: 1,
      short: '分類',
      caption: '分類器が質問の複雑さを A・B・C のどれかに決める。分類器は LLM ではなく別に学習した小型モデル',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-cls'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'cls', seconds: 0.7, label: '判定中' },
        {
          type: 'split',
          particle: 'q',
          at: 'cls',
          into: [
            { particle: 'qa', payload: { kind: 'query', label: 'A', tone: 'ok' } },
            { particle: 'qb', payload: { kind: 'query', label: 'B', tone: 'accent1' } },
            { particle: 'qc', payload: { kind: 'query', label: 'C', tone: 'warn' } },
          ],
        },
      ],
    },
    {
      n: 2,
      short: 'A',
      // 幹の 3 本の線のそばは混むので、経路が行き先の部品に入る手前に置く
      badge: { edge: 'e-cls-a', at: 0.8 },
      caption: 'A なら検索せず、質問をそのまま LLM に渡す',
      actions: [
        { type: 'travel', particle: 'qa', edges: ['e-cls-a'], payload: { kind: 'query', label: 'A', tone: 'ok' } },
        { type: 'travel', particle: 'qa', edges: ['e-a-llm'], payload: { kind: 'query', label: '質問', tone: 'ok' } },
      ],
    },
    {
      n: 3,
      short: 'B',
      badge: { edge: 'e-cls-b', at: 0.85 },
      caption: 'B なら 1 回だけ検索し、取れた文書と質問を LLM に渡す',
      actions: [
        { type: 'travel', particle: 'qb', edges: ['e-cls-b'], payload: { kind: 'query', label: 'B', tone: 'accent1' } },
        { type: 'dwell', particle: 'qb', node: 'b', seconds: 0.6, label: '検索中' },
        { type: 'travel', particle: 'qb', edges: ['e-b-llm'], payload: { kind: 'chunks', label: '文書と質問', tone: 'accent1', count: 3 } },
      ],
    },
    {
      n: 4,
      short: 'C',
      badge: { edge: 'e-cls-c', at: 0.88 },
      caption: 'C なら推論文を 1 文書いては、その文で検索し直す往復を繰り返す（IRCoT）',
      actions: [
        { type: 'travel', particle: 'qc', edges: ['e-cls-c'], payload: { kind: 'query', label: 'C', tone: 'warn' } },
        { type: 'dwell', particle: 'qc', node: 'c', seconds: 0.6, label: '検索中' },
        { type: 'travel', particle: 'qc', edges: ['e-c-llm'], payload: { kind: 'chunks', label: '文書', tone: 'warn', count: 3 } },
        { type: 'travel', particle: 'qc', edges: ['e-llm-c'], payload: { kind: 'text', label: '推論文', tone: 'warn' } },
        { type: 'dwell', particle: 'qc', node: 'c', seconds: 0.6, label: '2 回目' },
        { type: 'travel', particle: 'qc', edges: ['e-c-llm'], payload: { kind: 'chunks', label: '文書', tone: 'warn', count: 3 } },
      ],
    },
    {
      n: 5,
      short: '生成',
      caption: '選ばれた経路の材料で LLM が回答を書く。経路が深いほど遅いが、簡単な質問は速く済む',
      actions: [
        { type: 'merge', particles: ['qa', 'qb', 'qc'], at: 'llm', into: { particle: 'p', payload: { kind: 'prompt', label: 'プロンプト' } } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 136, laneGap: 52 },
  sources: [
    {
      title: 'Adaptive-RAG: Learning to Adapt Retrieval-Augmented Large Language Models through Question Complexity',
      authors: 'Jeong, S., Baek, J., Cho, S., Hwang, S. J., Park, J. C.',
      year: 2024,
      venue: 'NAACL 2024',
      arxiv: '2403.14403',
      note: '3 つの経路（no retrieval / single-step / multi-step）と T5 分類器は論文の 3 節。多段検索は IRCoT（Trivedi ほか 2023）',
    },
  ],
};
