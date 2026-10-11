import type { Diagram } from '../../model/diagram';
import { flowLane } from './lane';

// 最初の版の「Research Process」を略図で描き直したもの。部品は元の 6 つのまま。
// 問いから文献と仮説に分かれ、実験で合流し、結果が問いに答えていなければ問いに戻る。

export const firstResearch: Diagram = {
  id: 'first-research',
  title: '研究の進め方',
  subtitle: '問いを立てて確かめ、答えが出たら論文にする',
  lanes: flowLane,
  nodes: [
    { id: 'question', kind: 'query', label: '問い', lane: 'flow', col: 0, row: 0 },
    { id: 'lit', kind: 'documents', label: '文献調査', lane: 'flow', col: 1, row: 0 },
    { id: 'exp', kind: 'tool', label: '実験', lane: 'flow', col: 2, row: 0 },
    { id: 'result', kind: 'grader', label: '結果', lane: 'flow', col: 3, row: 0 },
    { id: 'hypo', kind: 'router', label: '仮説', lane: 'flow', col: 1, row: 1 },
    { id: 'paper', kind: 'answer', label: '論文', lane: 'flow', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-q-lit', from: 'question', to: 'lit' },
    { id: 'e-q-hypo', from: 'question', to: 'hypo', fromSide: 'bottom', toSide: 'left' },
    { id: 'e-lit-exp', from: 'lit', to: 'exp' },
    { id: 'e-hypo-exp', from: 'hypo', to: 'exp', fromSide: 'right', toSide: 'bottom' },
    { id: 'e-exp-result', from: 'exp', to: 'result' },
    { id: 'e-result-paper', from: 'result', to: 'paper', label: '答えが出た', fromSide: 'bottom', toSide: 'top', tone: 'ok' },
    { id: 'e-result-q', from: 'result', to: 'question', label: '問い直す', role: 'loop', fromSide: 'top', toSide: 'top', tone: 'warn' },
  ],
  steps: [
    {
      n: 1,
      short: '調べる',
      caption: '問いを立て、先行研究を調べながら仮説を立てる',
      actions: [
        { type: 'travel', particle: 'l', edges: ['e-q-lit'], payload: { kind: 'text', label: '文献' } },
        { type: 'travel', particle: 'h', edges: ['e-q-hypo'], payload: { kind: 'plan', label: '仮説' } },
      ],
    },
    {
      n: 2,
      short: '確かめる',
      caption: '文献で分かっていることと仮説を持ち寄り、実験で確かめる',
      actions: [
        { type: 'travel', particle: 'l', edges: ['e-lit-exp'], payload: { kind: 'text', label: '文献' } },
        { type: 'travel', particle: 'h', edges: ['e-hypo-exp'], payload: { kind: 'plan', label: '仮説' } },
        { type: 'merge', particles: ['l', 'h'], at: 'exp', into: { particle: 'x', payload: { kind: 'generic', label: '計画' } } },
        { type: 'dwell', particle: 'x', node: 'exp', seconds: 0.6, label: '実験中' },
        { type: 'travel', particle: 'x', edges: ['e-exp-result'], payload: { kind: 'score', label: 'データ' } },
      ],
    },
    {
      n: 3,
      short: '問い直す',
      caption: '結果が問いに答えていなければ、問いを立て直してもう一度',
      badge: { edge: 'e-result-q', at: 0.5 },
      actions: [{ type: 'highlight', edges: ['e-result-q'], nodes: ['question'] }],
    },
    {
      n: 4,
      short: '論文',
      caption: '答えが出たら論文にまとめて世に出す',
      actions: [
        { type: 'travel', particle: 'x', edges: ['e-result-paper'], payload: { kind: 'answer', label: '論文' } },
        { type: 'end', particle: 'x', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [],
};
