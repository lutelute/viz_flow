import type { Diagram } from '../../model/diagram';
import { naiveRag } from '../rag/naive';
import { flowLane } from './lane';

// 最初の版の「Naive RAG」を略図で描き直したもの。部品は元の 5 つに「文書」を 1 つ足しただけ。
// 元の版は質問だけが埋め込みを通っていたので、文書も同じ埋め込みモデルを通ることを描き足した。

export const firstNaive: Diagram = {
  id: 'first-naive',
  title: '基本の RAG',
  subtitle: '質問に近い文書を探して、LLM に添えて答えさせる',
  lanes: flowLane,
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書', lane: 'flow', col: 0, row: 0 },
    { id: 'embed', kind: 'embedding', label: '埋め込み\nモデル', lane: 'flow', col: 1, row: 0, opens: 'inside-embedding' },
    { id: 'vecdb', kind: 'vectordb', label: 'ベクトル DB', lane: 'flow', col: 2, row: 0, opens: 'inside-vectordb' },
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 1, row: 1 },
    { id: 'llm', kind: 'llm', label: 'LLM', lane: 'flow', col: 2, row: 1, opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-docs-embed', from: 'docs', to: 'embed' },
    { id: 'e-embed-db', from: 'embed', to: 'vecdb' },
    { id: 'e-user-embed', from: 'user', to: 'embed', label: '同じモデルで', fromSide: 'top', toSide: 'bottom', role: 'ref' },
    { id: 'e-db-llm', from: 'vecdb', to: 'llm', label: '近い文書', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-llm', from: 'user', to: 'llm', line: 'dashed' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '索引',
      caption: '文書を埋め込みモデルでベクトルにし、ベクトル DB にしまっておく',
      actions: [
        { type: 'travel', particle: 'doc', edges: ['e-docs-embed'], payload: { kind: 'text', label: '文書' } },
        { type: 'travel', particle: 'doc', edges: ['e-embed-db'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'doc', mode: 'absorb' },
      ],
    },
    {
      n: 2,
      short: '質問',
      caption: '質問も、文書と同じ埋め込みモデルでベクトルにする',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-embed'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'q2', edges: ['e-user-llm'], payload: { kind: 'query', label: '質問' } },
      ],
    },
    {
      n: 3,
      short: '検索',
      caption: 'ベクトル DB から質問に近い文書を取り出す。返ってくるのは答えではなく文書',
      badge: { edge: 'e-db-llm', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-embed-db'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'travel', particle: 'q', edges: ['e-db-llm'], payload: { kind: 'chunks', label: '近い 3 件', count: 3 } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: 'LLM が質問と文書を読み、文書を根拠に回答を書く',
      actions: [
        { type: 'merge', particles: ['q', 'q2'], at: 'llm', into: { particle: 'p', payload: { kind: 'prompt', label: '質問と文書' } } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: naiveRag.sources,
};
