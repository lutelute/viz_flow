import type { Diagram } from '../../model/diagram';

// 研究の流れ。問いから出版まで。査読で戻されて書き直すループがある。

export const researchProcess: Diagram = {
  id: 'research-process',
  title: '研究が論文になるまで',
  subtitle: '問いを立てて確かめ、書いて、直して、世に出す',
  lanes: [
    { id: 'ask', label: '問いを立てて確かめる', tone: 'accent1', frame: 'band' },
    { id: 'share', label: '書いて世に出す', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'question', kind: 'query', label: '問い', sublabel: 'まだ誰も答えていない', lane: 'ask', col: 0 },
    { id: 'survey', kind: 'documents', label: '文献調査', sublabel: '先行研究を読む', lane: 'ask', col: 1 },
    { id: 'hypo', kind: 'router', label: '仮説', sublabel: '否定できる形で', lane: 'ask', col: 2 },
    { id: 'exp', kind: 'tool', label: '実験と\nシミュレーション', lane: 'ask', col: 3 },
    { id: 'analysis', kind: 'grader', label: '解析', sublabel: '仮説は支持されたか', lane: 'share', col: 3 },
    { id: 'write', kind: 'prompt', label: '執筆', sublabel: '図と文で筋を通す', lane: 'share', col: 2 },
    { id: 'review', kind: 'grader', label: '査読', sublabel: '同業者が読む', lane: 'share', col: 1 },
    { id: 'publish', kind: 'answer', label: '出版', sublabel: '誰でも読める', lane: 'share', col: 0 },
  ],
  edges: [
    { id: 'e-q-survey', from: 'question', to: 'survey' },
    { id: 'e-survey-hypo', from: 'survey', to: 'hypo' },
    { id: 'e-hypo-exp', from: 'hypo', to: 'exp' },
    { id: 'e-exp-analysis', from: 'exp', to: 'analysis' },
    { id: 'e-analysis-write', from: 'analysis', to: 'write', fromSide: 'left', toSide: 'right' },
    { id: 'e-write-review', from: 'write', to: 'review', fromSide: 'left', toSide: 'right' },
    { id: 'e-review-write', from: 'review', to: 'write', role: 'loop', label: '修正して再投稿', fromSide: 'bottom', toSide: 'bottom' },
    { id: 'e-review-publish', from: 'review', to: 'publish', fromSide: 'left', toSide: 'right' },
    { id: 'e-analysis-q', from: 'analysis', to: 'question', role: 'ref', label: '次の問いへ', fromSide: 'top', toSide: 'bottom' },
  ],
  steps: [
    { n: 1, short: '問い', caption: '答えが分かっていない問いを 1 つ決める', actions: [{ type: 'travel', particle: 'p', edges: ['e-q-survey'], payload: { kind: 'query', label: '問い' } }] },
    { n: 2, short: '調査', caption: '先行研究を読み、どこまで分かっているかを押さえる', actions: [{ type: 'dwell', particle: 'p', node: 'survey', seconds: 0.8, label: '読む' }, { type: 'travel', particle: 'p', edges: ['e-survey-hypo'], payload: { kind: 'text', label: '知見' } }] },
    { n: 3, short: '仮説', caption: '結果次第で否定できる形の仮説にする', actions: [{ type: 'travel', particle: 'p', edges: ['e-hypo-exp'], payload: { kind: 'plan', label: '仮説' } }] },
    { n: 4, short: '実験', caption: '実験やシミュレーションで仮説を試す', actions: [{ type: 'dwell', particle: 'p', node: 'exp', seconds: 1.0, label: '測定中' }, { type: 'travel', particle: 'p', edges: ['e-exp-analysis'], payload: { kind: 'score', label: 'データ' } }] },
    { n: 5, short: '解析', caption: 'データを解析し、仮説が支持されたかを判断する', actions: [{ type: 'dwell', particle: 'p', node: 'analysis', seconds: 0.8, label: '解析中' }, { type: 'travel', particle: 'p', edges: ['e-analysis-write'], payload: { kind: 'score', label: '結果' } }] },
    { n: 6, short: '執筆', caption: '図と文で筋を通して書く', actions: [{ type: 'dwell', particle: 'p', node: 'write', seconds: 0.8, label: '執筆中' }, { type: 'travel', particle: 'p', edges: ['e-write-review'], payload: { kind: 'prompt', label: '原稿' } }] },
    { n: 7, short: '査読', caption: '同業者が読んで指摘する。たいてい一度は戻される', actions: [{ type: 'dwell', particle: 'p', node: 'review', seconds: 0.8, label: '査読中' }, { type: 'travel', particle: 'p', edges: ['e-review-write'], payload: { kind: 'text', label: '指摘', tone: 'warn' } }] },
    { n: 8, short: '改訂', caption: '指摘に答えて直し、再投稿する', actions: [{ type: 'dwell', particle: 'p', node: 'write', seconds: 0.6, label: '改訂中' }, { type: 'travel', particle: 'p', edges: ['e-write-review'], payload: { kind: 'prompt', label: '改訂稿' } }] },
    { n: 9, short: '出版', caption: '通れば出版され、誰でも読める。解析で出た新しい問いが次の研究になる', actions: [{ type: 'travel', particle: 'p', edges: ['e-review-publish'], payload: { kind: 'answer', label: '論文' } }, { type: 'end', particle: 'p', mode: 'stay' }, { type: 'highlight', edges: ['e-analysis-q'], nodes: ['question'] }], hold: 1.2 },
  ],
  sources: [],
};
