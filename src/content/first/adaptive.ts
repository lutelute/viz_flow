import type { Diagram } from '../../model/diagram';
import { adaptiveRag } from '../rag/adaptive';
import { flowLane } from './lane';

// 最初の版の「Adaptive RAG」を略図で描き直したもの。部品は元の 6 つに「回答」を足した 7 つ。
// 元の版の 3 つの行き先（単純な RAG / 多段 / Web 検索）は、論文（Jeong ほか 2024）どおり
// 検索の深さの 3 段階（検索なし / 1 回 / 多段）に直した。振り分けるのは LLM ではなく小型の分類器。

export const firstAdaptive: Diagram = {
  id: 'first-adaptive',
  title: 'Adaptive-RAG',
  subtitle: '質問の難しさを見て、検索の深さを変える',
  detail: adaptiveRag.id,
  lanes: flowLane,
  nodes: [
    { id: 'a', kind: 'router', label: 'A 検索なし', lane: 'flow', col: 2, row: 0 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 0 },
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 0, row: 1 },
    { id: 'cls', kind: 'grader', label: '分類器', sublabel: '小型。LLM とは別', lane: 'flow', col: 1, row: 1 },
    { id: 'b', kind: 'retriever', label: 'B 1 回検索', lane: 'flow', col: 2, row: 1 },
    { id: 'llm', kind: 'llm', label: 'LLM', lane: 'flow', col: 3, row: 1, opens: 'inside-llm' },
    { id: 'c', kind: 'retriever', label: 'C 多段検索', lane: 'flow', col: 2, row: 2 },
  ],
  edges: [
    { id: 'e-user-cls', from: 'user', to: 'cls' },
    { id: 'e-cls-a', from: 'cls', to: 'a', role: 'branch', branch: { group: 'k', option: 'a' }, fromSide: 'right', toSide: 'left', tone: 'ok' },
    { id: 'e-cls-b', from: 'cls', to: 'b', role: 'branch', branch: { group: 'k', option: 'b' }, fromSide: 'right', toSide: 'left', tone: 'accent1' },
    { id: 'e-cls-c', from: 'cls', to: 'c', role: 'branch', branch: { group: 'k', option: 'c' }, fromSide: 'right', toSide: 'left', tone: 'warn' },
    { id: 'e-a-llm', from: 'a', to: 'llm' },
    { id: 'e-b-llm', from: 'b', to: 'llm' },
    { id: 'e-c-llm', from: 'c', to: 'llm' },
    { id: 'e-llm-c', from: 'llm', to: 'c', label: 'もう一度', role: 'loop', fromSide: 'bottom', toSide: 'bottom', tone: 'warn' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'top', toSide: 'bottom' },
  ],
  steps: [
    {
      n: 1,
      short: '分類',
      caption: '小型の分類器が、質問の複雑さを A・B・C の 3 つに分ける',
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
      short: 'A と B',
      caption: 'A なら検索せずにそのまま、B なら 1 回だけ検索してから LLM に渡す',
      actions: [
        { type: 'travel', particle: 'qa', edges: ['e-cls-a', 'e-a-llm'], payload: { kind: 'query', label: '質問', tone: 'ok' } },
        { type: 'travel', particle: 'qb', edges: ['e-cls-b'], payload: { kind: 'query', label: '質問', tone: 'accent1' } },
        { type: 'travel', particle: 'qb', edges: ['e-b-llm'], payload: { kind: 'chunks', label: '文書', tone: 'accent1', count: 3 } },
      ],
    },
    {
      n: 3,
      short: 'C',
      caption: 'C なら、推論の 1 文を書いてはその文で検索し直す往復を、足りるまで繰り返す',
      badge: { edge: 'e-llm-c', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'qc', edges: ['e-cls-c'], payload: { kind: 'query', label: '質問', tone: 'warn' } },
        { type: 'travel', particle: 'qc', edges: ['e-c-llm'], payload: { kind: 'chunks', label: '文書', tone: 'warn', count: 3 } },
        { type: 'travel', particle: 'qc', edges: ['e-llm-c'], payload: { kind: 'text', label: '推論文', tone: 'warn' } },
        { type: 'travel', particle: 'qc', edges: ['e-c-llm'], payload: { kind: 'chunks', label: '文書', tone: 'warn', count: 3 } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: '選ばれた道の材料で LLM が回答を書く。3 つの道は検索の深さの違いで、データの出どころの違いではない',
      actions: [
        { type: 'merge', particles: ['qa', 'qb', 'qc'], at: 'llm', into: { particle: 'p', payload: { kind: 'prompt', label: 'プロンプト' } } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: adaptiveRag.sources,
};
