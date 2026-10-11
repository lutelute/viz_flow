import type { Diagram } from '../../model/diagram';

// 計測データが図になるまで。集めて整え、しまって、使う。

export const dataPipeline: Diagram = {
  id: 'data-pipeline',
  title: '計測データが図になるまで',
  subtitle: 'センサーや CSV から取り込み、検証と変換を経てしまい、学習と可視化に使う',
  lanes: [
    { id: 'collect', label: '集めて整える', tone: 'accent1', frame: 'band' },
    { id: 'use', label: 'しまって使う', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'source', kind: 'documents', label: 'センサー・CSV', sublabel: '生データ', lane: 'collect', col: 0 },
    { id: 'ingest', kind: 'tool', label: '取り込み', sublabel: '定時に取りに行く', lane: 'collect', col: 1 },
    { id: 'validate', kind: 'grader', label: '検証', sublabel: '欠損・型・範囲', lane: 'collect', col: 2 },
    { id: 'transform', kind: 'chunker', label: '変換', sublabel: '単位を揃えて集計', lane: 'collect', col: 3 },
    { id: 'store', kind: 'vectordb', label: '保存', sublabel: 'データウェアハウス', lane: 'use', col: 3 },
    { id: 'model', kind: 'llm', label: '学習と推論', sublabel: '予測モデル', lane: 'use', col: 2 },
    { id: 'viz', kind: 'index', label: '可視化', sublabel: 'ダッシュボード', lane: 'use', col: 1 },
    { id: 'share', kind: 'answer', label: '共有', sublabel: '毎朝届く', lane: 'use', col: 0 },
  ],
  edges: [
    { id: 'e-src-ingest', from: 'source', to: 'ingest' },
    { id: 'e-ingest-validate', from: 'ingest', to: 'validate' },
    { id: 'e-validate-transform', from: 'validate', to: 'transform' },
    { id: 'e-transform-store', from: 'transform', to: 'store' },
    { id: 'e-store-model', from: 'store', to: 'model', fromSide: 'left', toSide: 'right' },
    { id: 'e-model-viz', from: 'model', to: 'viz', fromSide: 'left', toSide: 'right' },
    { id: 'e-viz-share', from: 'viz', to: 'share', fromSide: 'left', toSide: 'right' },
    { id: 'e-validate-src', from: 'validate', to: 'source', role: 'loop', label: '弾いたものは知らせる', fromSide: 'top', toSide: 'top' },
  ],
  steps: [
    { n: 1, short: '取り込み', caption: 'センサーや CSV から生データを定時に取りに行く', actions: [{ type: 'travel', particle: 'd', edges: ['e-src-ingest'], payload: { kind: 'text', label: '生データ' } }] },
    { n: 2, short: '検証', caption: '欠損・型・範囲を検証し、おかしい行は弾いて知らせる', actions: [{ type: 'travel', particle: 'd', edges: ['e-ingest-validate'], payload: { kind: 'chunks', label: '行×N', count: 3 } }, { type: 'dwell', particle: 'd', node: 'validate', seconds: 0.7, label: '検証中' }, { type: 'highlight', edges: ['e-validate-src'] }] },
    { n: 3, short: '変換', caption: '単位を揃え、時間ごとに集計して扱いやすい形にする', actions: [{ type: 'travel', particle: 'd', edges: ['e-validate-transform'], payload: { kind: 'chunks', label: '整った行', count: 3 } }] },
    { n: 4, short: '保存', caption: 'データウェアハウスにしまう。あとから何度でも使える', actions: [{ type: 'travel', particle: 'd', edges: ['e-transform-store'], payload: { kind: 'tokens', label: '集計表' } }] },
    { n: 5, short: '学習', caption: '保存したデータで予測モデルを学習し、推論する', actions: [{ type: 'travel', particle: 'd', edges: ['e-store-model'], payload: { kind: 'tokens', label: '集計表' } }, { type: 'dwell', particle: 'd', node: 'model', seconds: 0.8, label: '学習中' }] },
    { n: 6, short: '可視化', caption: '実測と予測をダッシュボードに描く', actions: [{ type: 'travel', particle: 'd', edges: ['e-model-viz'], payload: { kind: 'score', label: '予測' } }] },
    { n: 7, short: '共有', caption: '毎朝、図が関係者に届く', actions: [{ type: 'travel', particle: 'd', edges: ['e-viz-share'], payload: { kind: 'image', label: '図' } }, { type: 'end', particle: 'd', mode: 'stay' }], hold: 1.2 },
  ],
  sources: [],
};
