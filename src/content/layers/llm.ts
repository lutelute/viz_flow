import type { Diagram } from '../../model/diagram';
import { vaswani2017 } from './sources';

// LLM の中。1 語ずつ前から書く（自己回帰）。選んだ 1 語を末尾に足して、またデコーダに通す。
// 検索結果を読んだかどうかで、この仕組みは変わらない。

export const insideLlm: Diagram = {
  id: 'inside-llm',
  title: 'LLM の中',
  subtitle: '次の 1 語の確率を出して 1 つ選び、末尾に足しては繰り返す',
  lanes: [
    { id: 'gen', label: '1 語ずつ書く', tone: 'accent1', frame: 'band' },
    { id: 'end', label: '書き終えたら', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'in', kind: 'port', label: 'プロンプト', sublabel: '外の図から入る', lane: 'gen', col: 0, emphasis: 'muted' },
    { id: 'tok', kind: 'chunker', label: 'トークンに\n分ける', sublabel: '部分語を番号に', lane: 'gen', col: 1 },
    { id: 'dec', kind: 'llm', label: 'Transformer\nデコーダ', sublabel: '前だけを見る', lane: 'gen', col: 2, emphasis: 'new', opens: 'inside-attention' },
    { id: 'prob', kind: 'policy', label: '次の 1 語の\n確率', sublabel: '語彙のすべてに', lane: 'gen', col: 3 },
    { id: 'pick', kind: 'router', label: '1 語を選ぶ', sublabel: '温度で揺らぎを調整', lane: 'gen', col: 3, row: 1 },
    { id: 'append', kind: 'memory', label: '末尾に足す', sublabel: '前の計算は残す', lane: 'gen', col: 2, row: 1 },
    { id: 'detok', kind: 'documents', label: '文字に戻す', sublabel: '終わりの記号で止める', lane: 'end', col: 3 },
    { id: 'out', kind: 'port', label: '回答', sublabel: '外の図へ出る', lane: 'end', col: 2, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-in-tok', from: 'in', to: 'tok' },
    { id: 'e-tok-dec', from: 'tok', to: 'dec' },
    { id: 'e-dec-prob', from: 'dec', to: 'prob' },
    { id: 'e-prob-pick', from: 'prob', to: 'pick', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-pick-append', from: 'pick', to: 'append', fromSide: 'left', toSide: 'right' },
    { id: 'e-append-dec', from: 'append', to: 'dec', label: 'もう一度', fromSide: 'top', toSide: 'bottom', role: 'loop' },
    { id: 'e-pick-detok', from: 'pick', to: 'detok', label: '終わり', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-detok-out', from: 'detok', to: 'out', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '分ける',
      caption: 'プロンプトを部分語のトークンに分け、番号の列にする',
      actions: [{ type: 'travel', particle: 't', edges: ['e-in-tok'], payload: { kind: 'prompt', label: 'プロンプト' } }],
    },
    {
      n: 2,
      short: '読む',
      caption: 'デコーダの層に通す。各トークンは自分より前のトークンだけに注意を向ける',
      detail: 'この部品をひらくと、注意の計算の中に入れる',
      actions: [
        { type: 'travel', particle: 't', edges: ['e-tok-dec'], payload: { kind: 'tokens', label: 'トークン列' } },
        { type: 'dwell', particle: 't', node: 'dec', seconds: 0.8, label: '層を通る' },
      ],
    },
    {
      n: 3,
      short: '確率',
      caption: '最後の位置のベクトルから、語彙のすべてのトークンについて次に来る確率を出す',
      actions: [{ type: 'travel', particle: 't', edges: ['e-dec-prob'], payload: { kind: 'score', label: '確率' } }],
    },
    {
      n: 4,
      short: '選ぶ',
      caption: '確率に従って 1 語を選ぶ。温度を下げるほど、最も確からしい語に寄る',
      actions: [{ type: 'travel', particle: 't', edges: ['e-prob-pick'], payload: { kind: 'score', label: '確率' } }],
    },
    {
      n: 5,
      short: '足す',
      caption: '選んだ 1 語を列の末尾に足し、もう一度デコーダに通す。前の計算は KV キャッシュに残すので、新しい 1 語のぶんだけ計算する',
      actions: [
        { type: 'travel', particle: 't', edges: ['e-pick-append'], payload: { kind: 'tokens', label: '1 語' } },
        { type: 'travel', particle: 't', edges: ['e-append-dec'], payload: { kind: 'tokens', label: '列と 1 語' } },
      ],
    },
    {
      n: 6,
      short: '終わり',
      caption: '終わりの記号が出るか上限の長さに達するまで繰り返し、トークンを文字に戻す',
      badge: { edge: 'e-pick-detok', at: 0.5 },
      actions: [
        { type: 'travel', particle: 't', edges: ['e-dec-prob', 'e-prob-pick'], payload: { kind: 'score', label: '確率' } },
        { type: 'travel', particle: 't', edges: ['e-pick-detok'], payload: { kind: 'tokens', label: '書いた列' } },
      ],
    },
    {
      n: 7,
      short: '渡す',
      caption: '1 語ずつ書いた文章が回答になる。検索結果を読んだかどうかで、この仕組みは変わらない',
      actions: [
        { type: 'travel', particle: 't', edges: ['e-detok-out'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 't', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    { ...vaswani2017, note: 'デコーダの自己注意で後ろのトークンを隠すのは 3.2.3 節' },
    {
      title: 'Language Models are Few-Shot Learners',
      authors: 'Brown, T. B. ほか',
      year: 2020,
      venue: 'NeurIPS 2020',
      arxiv: '2005.14165',
      note: '前のトークンから次の 1 語を予測して書き進める言語モデル（GPT-3）',
    },
  ],
};
