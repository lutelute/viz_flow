import type { Diagram } from '../../model/diagram';
import { graphRag } from '../rag/graph';
import { flowLane } from './lane';

// 最初の版の「Graph RAG」を略図で描き直したもの。部品は元の 6 つに「回答」を足した 7 つ。
// 元の版は「グラフをたどって答える」だったが、Microsoft の GraphRAG（Edge ほか 2024）は
// まとまりごとの要約を先に作り、質問には要約から部分回答を作って束ねる。

export const firstGraph: Diagram = {
  id: 'first-graph',
  title: 'GraphRAG',
  subtitle: 'グラフのまとまりごとに要約を作っておき、要約から答える',
  detail: graphRag.id,
  lanes: flowLane,
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書', lane: 'flow', col: 0, row: 0 },
    { id: 'extract', kind: 'llm', label: 'LLM で抽出', sublabel: '実体と関係', lane: 'flow', col: 1, row: 0, opens: 'inside-llm' },
    { id: 'kg', kind: 'graphdb', label: '知識グラフ', lane: 'flow', col: 2, row: 0 },
    { id: 'summ', kind: 'documents', label: 'まとまりの\n要約', lane: 'flow', col: 3, row: 0 },
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 0, row: 1 },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '要約ごとに答えて束ねる', lane: 'flow', col: 2, row: 1, opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-docs-ext', from: 'docs', to: 'extract' },
    { id: 'e-ext-kg', from: 'extract', to: 'kg' },
    { id: 'e-kg-summ', from: 'kg', to: 'summ' },
    { id: 'e-summ-llm', from: 'summ', to: 'llm', label: '要約', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-llm', from: 'user', to: 'llm' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '抽出',
      caption: 'LLM が文書から実体（人・物・概念）と、その間の関係を抜き出し、グラフにする',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-docs-ext'], payload: { kind: 'text', label: '文書' } },
        { type: 'travel', particle: 'd', edges: ['e-ext-kg'], payload: { kind: 'graph', label: '実体と関係' } },
      ],
    },
    {
      n: 2,
      short: '要約',
      caption: 'グラフをまとまり（コミュニティ）に分け、まとまりごとの要約を先に作っておく',
      actions: [{ type: 'travel', particle: 'd', edges: ['e-kg-summ'], payload: { kind: 'text', label: '要約' } }],
    },
    {
      n: 3,
      short: '部分回答',
      caption: '質問が来たら、要約ごとに部分回答を作り、役に立つ度合いを点数にする',
      badge: { edge: 'e-summ-llm', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-llm'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'd', edges: ['e-summ-llm'], payload: { kind: 'chunks', label: '要約×N', count: 3 } },
      ],
    },
    {
      n: 4,
      short: '統合',
      caption: '点数の高い部分回答から積み上げて、全体の回答にまとめる。グラフをたどって答えるのではない',
      actions: [
        { type: 'merge', particles: ['q', 'd'], at: 'llm', into: { particle: 'p', payload: { kind: 'score', label: '部分回答' } } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '束ね中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: graphRag.sources,
};
