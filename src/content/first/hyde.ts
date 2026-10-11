import type { Diagram } from '../../model/diagram';
import { hydeRag } from '../rag/hyde';
import { flowLane } from './lane';

// 最初の版の「HyDE RAG」を略図で描き直したもの。部品は元の 6 つのまま。
// 仮の文書は検索のためだけに使い、回答には本物の文書を使う（Gao ほか 2022）。

export const firstHyde: Diagram = {
  id: 'first-hyde',
  title: 'HyDE',
  subtitle: '答えらしい仮の文書を書かせ、それに似た本物の文書を探す',
  detail: hydeRag.id,
  lanes: flowLane,
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 0, row: 0 },
    { id: 'llm1', kind: 'llm', label: 'LLM', sublabel: '仮の文書を書く', lane: 'flow', col: 1, row: 0, opens: 'inside-llm' },
    { id: 'enc', kind: 'encoder', label: 'エンコーダ', lane: 'flow', col: 2, row: 0, opens: 'inside-embedding' },
    { id: 'vecdb', kind: 'vectordb', label: 'ベクトル DB', lane: 'flow', col: 3, row: 0, opens: 'inside-vectordb' },
    { id: 'llm2', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'flow', col: 2, row: 1, opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-user-llm1', from: 'user', to: 'llm1' },
    { id: 'e-llm1-enc', from: 'llm1', to: 'enc', label: '仮の文書' },
    { id: 'e-enc-db', from: 'enc', to: 'vecdb' },
    { id: 'e-db-llm2', from: 'vecdb', to: 'llm2', label: '本物の文書', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-llm2', from: 'user', to: 'llm2', fromSide: 'bottom', toSide: 'left', line: 'dashed' },
    { id: 'e-llm2-answer', from: 'llm2', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '仮の文書',
      caption: 'LLM が、質問に答えるつもりで仮の文書を書く。中身は間違っていてもよい',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-llm1'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'llm1', seconds: 0.7, label: '下書き中' },
        { type: 'travel', particle: 'q', edges: ['e-llm1-enc'], payload: { kind: 'text', label: '仮の文書', ghost: true } },
      ],
    },
    {
      n: 2,
      short: 'ベクトル化',
      caption: '仮の文書をエンコーダでベクトルにする。仮の文書はここで捨てる',
      actions: [{ type: 'travel', particle: 'q', edges: ['e-enc-db'], payload: { kind: 'vector', label: 'ベクトル' } }],
    },
    {
      n: 3,
      short: '検索',
      caption: 'そのベクトルに近い本物の文書をベクトル DB から探す',
      badge: { edge: 'e-db-llm2', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-db-llm2'], payload: { kind: 'chunks', label: '本物の文書', count: 3 } },
        { type: 'travel', particle: 'q2', edges: ['e-user-llm2'], payload: { kind: 'query', label: '質問' } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: 'LLM が質問と本物の文書から回答を書く。仮の文書は回答に使わない',
      actions: [
        { type: 'merge', particles: ['q', 'q2'], at: 'llm2', into: { particle: 'p', payload: { kind: 'prompt', label: '質問と文書' } } },
        { type: 'dwell', particle: 'p', node: 'llm2', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm2-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: hydeRag.sources,
};
