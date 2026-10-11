import type { Diagram } from '../../model/diagram';
import { agenticRag } from '../rag/agentic';
import { flowLane } from './lane';

// 最初の版の「Agentic RAG」を略図で描き直したもの。部品は元の 7 つのまま。
// 元の版は「計画 → 道具 3 つ → 統合」の一方通行だった。エージェント型の要は、結果を見て
// 足りなければ計画に戻るループなので、その戻りを描いた（Singh ほか 2025）。

export const firstAgentic: Diagram = {
  id: 'first-agentic',
  title: 'エージェント型 RAG',
  subtitle: '道具を選んで呼び、結果を見て足りなければやり直す',
  detail: agenticRag.id,
  lanes: flowLane,
  nodes: [
    { id: 'vec', kind: 'vectordb', label: 'ベクトル DB', lane: 'flow', col: 2, row: 0, opens: 'inside-vectordb' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 0 },
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 0, row: 1 },
    { id: 'agent', kind: 'agent', label: 'エージェント', sublabel: '計画して道具を選ぶ', lane: 'flow', col: 1, row: 1 },
    { id: 'web', kind: 'web', label: 'Web 検索', lane: 'flow', col: 2, row: 1 },
    { id: 'check', kind: 'grader', label: '振り返り', sublabel: '足りるか確かめる', lane: 'flow', col: 3, row: 1 },
    { id: 'code', kind: 'tool', label: 'コード実行', lane: 'flow', col: 2, row: 2 },
  ],
  edges: [
    { id: 'e-user-agent', from: 'user', to: 'agent' },
    { id: 'e-agent-vec', from: 'agent', to: 'vec', role: 'branch', branch: { group: 't', option: 'vec' }, fromSide: 'right', toSide: 'left' },
    { id: 'e-agent-web', from: 'agent', to: 'web', role: 'branch', branch: { group: 't', option: 'web' }, fromSide: 'right', toSide: 'left' },
    { id: 'e-agent-code', from: 'agent', to: 'code', role: 'branch', branch: { group: 't', option: 'code' }, fromSide: 'right', toSide: 'left' },
    { id: 'e-vec-check', from: 'vec', to: 'check' },
    { id: 'e-web-check', from: 'web', to: 'check' },
    { id: 'e-code-check', from: 'code', to: 'check' },
    { id: 'e-check-agent', from: 'check', to: 'agent', label: '足りない', role: 'loop', fromSide: 'bottom', toSide: 'bottom', tone: 'warn' },
    { id: 'e-check-answer', from: 'check', to: 'answer', label: '足りた', fromSide: 'top', toSide: 'bottom', tone: 'ok' },
  ],
  steps: [
    {
      n: 1,
      short: '計画',
      caption: 'エージェント（LLM）が質問を小さな作業に分け、作業ごとに使う道具を選ぶ',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-agent'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'agent', seconds: 0.8, label: '計画中' },
        {
          type: 'split',
          particle: 'q',
          at: 'agent',
          into: [
            { particle: 't1', payload: { kind: 'plan', label: '作業' } },
            { particle: 't2', payload: { kind: 'plan', label: '作業' } },
            { particle: 't3', payload: { kind: 'plan', label: '作業' } },
          ],
        },
      ],
    },
    {
      n: 2,
      short: '道具',
      caption: '選んだ道具を呼ぶ。文書の検索、Web 検索、コードの実行など',
      actions: [
        { type: 'travel', particle: 't1', edges: ['e-agent-vec'], payload: { kind: 'plan', label: '作業' } },
        { type: 'travel', particle: 't2', edges: ['e-agent-web'], payload: { kind: 'plan', label: '作業' } },
        { type: 'travel', particle: 't3', edges: ['e-agent-code'], payload: { kind: 'plan', label: '作業' } },
      ],
    },
    {
      n: 3,
      short: '振り返り',
      caption: '道具の結果を集め、答えるのに足りるかを確かめる',
      actions: [
        { type: 'travel', particle: 't1', edges: ['e-vec-check'], payload: { kind: 'chunks', label: '文書', count: 2 } },
        { type: 'travel', particle: 't2', edges: ['e-web-check'], payload: { kind: 'text', label: '検索結果' } },
        { type: 'travel', particle: 't3', edges: ['e-code-check'], payload: { kind: 'score', label: '計算結果' } },
        { type: 'merge', particles: ['t1', 't2', 't3'], at: 'check', into: { particle: 'r', payload: { kind: 'chunks', label: '結果', count: 3 } } },
        { type: 'dwell', particle: 'r', node: 'check', seconds: 0.6, label: '確認中' },
      ],
    },
    {
      n: 4,
      short: 'やり直し',
      caption: '足りなければ計画に戻り、別の道具や別の問い方で探し直す。この往復がエージェント型の要',
      badge: { edge: 'e-check-agent', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'r', edges: ['e-check-agent'], payload: { kind: 'plan', label: '足りない点', tone: 'warn' } },
        { type: 'dwell', particle: 'r', node: 'agent', seconds: 0.5, label: '計画し直し' },
        { type: 'travel', particle: 'r', edges: ['e-agent-web'], payload: { kind: 'plan', label: '作業' } },
        { type: 'travel', particle: 'r', edges: ['e-web-check'], payload: { kind: 'text', label: '検索結果' } },
      ],
    },
    {
      n: 5,
      short: '回答',
      caption: '足りたら、根拠を添えて回答する',
      actions: [
        { type: 'travel', particle: 'r', edges: ['e-check-answer'], payload: { kind: 'answer', label: '回答', tone: 'ok' } },
        { type: 'end', particle: 'r', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: agenticRag.sources.filter((s) => !s.title.includes('Model Context Protocol')),
};
