import type { Diagram } from '../../model/diagram';
import { vaswani2017 } from './sources';

// 自己注意の中（1 つの頭）。埋め込みモデルのエンコーダと LLM のデコーダの両方からここへ入る。
// 違いは「後ろを隠すかどうか」だけなので、隠す手順を 1 つの部品にして、エンコーダでは飛ばすと書く。

export const insideAttention: Diagram = {
  id: 'inside-attention',
  title: '自己注意の中',
  subtitle: '各トークンが、ほかのどのトークンをどれだけ参考にするかを決めて混ぜる',
  lanes: [
    { id: 'score', label: '点数を出す', tone: 'accent1', frame: 'band' },
    { id: 'mix', label: '重みにして混ぜる', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'in', kind: 'port', label: 'ベクトル列', sublabel: '外の図から入る', lane: 'score', col: 0, emphasis: 'muted' },
    { id: 'qkv', kind: 'index', label: '問い・鍵・値', sublabel: 'Q・K・V を作る', lane: 'score', col: 1 },
    { id: 'dot', kind: 'grader', label: '内積の点数', sublabel: 'Q と K、√d で割る', lane: 'score', col: 2 },
    { id: 'mask', kind: 'policy', label: '後ろを隠す', sublabel: 'LLM のときだけ', lane: 'score', col: 3, emphasis: 'muted' },
    { id: 'soft', kind: 'router', label: 'softmax', sublabel: '合計 1 の重みに', lane: 'mix', col: 2 },
    { id: 'sum', kind: 'embedding', label: '値の\n重み付き和', sublabel: '新しいベクトル', lane: 'mix', col: 1 },
    { id: 'out', kind: 'port', label: '文脈入りの列', sublabel: '外の図へ出る', lane: 'mix', col: 0, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-in-qkv', from: 'in', to: 'qkv' },
    { id: 'e-qkv-dot', from: 'qkv', to: 'dot', label: 'Q と K' },
    { id: 'e-dot-mask', from: 'dot', to: 'mask' },
    { id: 'e-mask-soft', from: 'mask', to: 'soft', fromSide: 'bottom', toSide: 'right' },
    { id: 'e-soft-sum', from: 'soft', to: 'sum', fromSide: 'left', toSide: 'right' },
    { id: 'e-qkv-sum', from: 'qkv', to: 'sum', label: '値 V', fromSide: 'bottom', toSide: 'top', line: 'dashed' },
    { id: 'e-sum-out', from: 'sum', to: 'out', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '3 つ作る',
      caption: '各トークンのベクトルに 3 つの行列を掛け、問い（Q）・鍵（K）・値（V）を作る',
      actions: [{ type: 'travel', particle: 'x', edges: ['e-in-qkv'], payload: { kind: 'tokens', label: 'ベクトル列' } }],
    },
    {
      n: 2,
      short: '点数',
      caption: 'あるトークンの問いと、すべてのトークンの鍵の内積を取り、√d で割って点数にする（d は鍵の次元）',
      actions: [{ type: 'travel', particle: 'x', edges: ['e-qkv-dot'], payload: { kind: 'vector', label: 'Q と K' } }],
    },
    {
      n: 3,
      short: '隠す',
      caption: 'LLM では、自分より後ろのトークンの点数を −∞ にして見えなくする。埋め込みモデルではこの手順を飛ばす',
      actions: [{ type: 'travel', particle: 'x', edges: ['e-dot-mask'], payload: { kind: 'score', label: '点数' } }],
    },
    {
      n: 4,
      short: '重み',
      badge: { edge: 'e-mask-soft', at: 0.3 },
      caption: 'softmax で点数を合計 1 の重みにする。点数の高いトークンほど大きな重みになる',
      actions: [{ type: 'travel', particle: 'x', edges: ['e-mask-soft'], payload: { kind: 'score', label: '点数' } }],
    },
    {
      n: 5,
      short: '混ぜる',
      caption: '値を重みで足し合わせ、そのトークンの新しいベクトルにする',
      badge: { edge: 'e-soft-sum', at: 0.5 },
      actions: [
        { type: 'travel', particle: 'x', edges: ['e-soft-sum'], payload: { kind: 'score', label: '重み' } },
        { type: 'travel', particle: 'v', edges: ['e-qkv-sum'], payload: { kind: 'vector', label: '値' } },
        { type: 'merge', particles: ['x', 'v'], at: 'sum', into: { particle: 'y', payload: { kind: 'tokens', label: '新しい列' } } },
      ],
    },
    {
      n: 6,
      short: '頭を並べる',
      caption: '同じ計算を複数の頭で並べて行い、結果をつなげる。頭ごとに別の観点で注意を向けられる',
      actions: [
        { type: 'travel', particle: 'y', edges: ['e-sum-out'], payload: { kind: 'tokens', label: '文脈入りの列' } },
        { type: 'end', particle: 'y', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    { ...vaswani2017, note: '√d で割る式は 3.2.1 節、複数の頭は 3.2.2 節、デコーダで後ろを隠すのは 3.2.3 節' },
  ],
};
