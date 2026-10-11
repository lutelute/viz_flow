import type { Diagram } from '../../model/diagram';
import { correctiveRag } from '../rag/corrective';
import { flowLane } from './lane';

// 最初の版の「Corrective RAG」を略図で描き直したもの。部品は元の 6 つのまま。
// 採点するのは LLM ではなく別の小型の評価器で、判定は 3 つ（Yan ほか 2024）。図は 2 つの枝だけ描き、
// 「あいまい」は両方の枝を使うことをキャプションで添える。

export const firstCorrective: Diagram = {
  id: 'first-corrective',
  title: 'CRAG（訂正つき RAG）',
  subtitle: '取り出した文書を採点し、駄目なら Web で探し直す',
  lanes: flowLane,
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 0, row: 0 },
    { id: 'ret', kind: 'retriever', label: '検索', lane: 'flow', col: 1, row: 0 },
    { id: 'eval', kind: 'grader', label: '評価器', sublabel: '小型。LLM とは別', lane: 'flow', col: 2, row: 0 },
    { id: 'llm', kind: 'llm', label: 'LLM', lane: 'flow', col: 3, row: 1, opens: 'inside-llm' },
    { id: 'web', kind: 'web', label: 'Web 検索', lane: 'flow', col: 2, row: 1 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 2 },
  ],
  edges: [
    { id: 'e-user-ret', from: 'user', to: 'ret' },
    { id: 'e-ret-eval', from: 'ret', to: 'eval' },
    { id: 'e-eval-llm', from: 'eval', to: 'llm', label: '正しい', fromSide: 'right', toSide: 'top', tone: 'ok' },
    { id: 'e-eval-web', from: 'eval', to: 'web', label: '誤り', fromSide: 'bottom', toSide: 'top', tone: 'ng' },
    { id: 'e-web-llm', from: 'web', to: 'llm' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    {
      n: 1,
      short: '検索',
      caption: '質問で文書を検索して取り出す',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-ret'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'q', edges: ['e-ret-eval'], payload: { kind: 'chunks', label: '取得文書', count: 3 } },
      ],
    },
    {
      n: 2,
      short: '採点',
      caption: '小型の評価器が文書を採点し、正しい・誤り・あいまいに分ける。あいまいなら下の 2 つを両方使う',
      actions: [
        { type: 'dwell', particle: 'q', node: 'eval', seconds: 0.7, label: '採点中' },
        {
          type: 'split',
          particle: 'q',
          at: 'eval',
          into: [
            { particle: 'ok', payload: { kind: 'chunks', label: '正しい', tone: 'ok', count: 2 } },
            { particle: 'ng', payload: { kind: 'query', label: '誤り', tone: 'ng' } },
          ],
        },
      ],
    },
    {
      n: 3,
      short: '訂正',
      caption: '正しい文書はそのまま使う。誤りなら文書を捨て、質問をキーワードにして Web で探し直す',
      badge: { edge: 'e-eval-web', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'ok', edges: ['e-eval-llm'], payload: { kind: 'chunks', label: '正しい文書', tone: 'ok', count: 2 } },
        { type: 'travel', particle: 'ng', edges: ['e-eval-web'], payload: { kind: 'query', label: 'キーワード', tone: 'ng' } },
        { type: 'travel', particle: 'ng', edges: ['e-web-llm'], payload: { kind: 'chunks', label: 'Web の結果', tone: 'ng', count: 2 } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: 'LLM が、残った文書をもとに回答を書く。訂正されるのは回答ではなく検索結果',
      actions: [
        { type: 'merge', particles: ['ok', 'ng'], at: 'llm', into: { particle: 'p', payload: { kind: 'prompt', label: '質問と文書' } } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: correctiveRag.sources,
};
