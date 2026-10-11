import type { Diagram } from '../../model/diagram';
import { dataPipeline } from '../data/pipeline';
import { flowLane } from './lane';

// 最初の版の「Data Pipeline」を略図で描き直したもの。部品も並びも元の 6 つのまま、折り返して 2 段にする。

export const firstPipeline: Diagram = {
  id: 'first-pipeline',
  title: 'データパイプライン',
  subtitle: 'データを集めて整え、学習して、結果を見せる',
  detail: dataPipeline.id,
  lanes: flowLane,
  nodes: [
    { id: 'source', kind: 'documents', label: 'データ源', sublabel: 'API・CSV・DB', lane: 'flow', col: 0, row: 0 },
    { id: 'clean', kind: 'grader', label: '掃除', sublabel: '欠損と重複', lane: 'flow', col: 1, row: 0 },
    { id: 'transform', kind: 'chunker', label: '変換', sublabel: '集計しやすい形に', lane: 'flow', col: 2, row: 0 },
    { id: 'model', kind: 'llm', label: '学習モデル', sublabel: '予測する', lane: 'flow', col: 2, row: 1 },
    { id: 'dash', kind: 'index', label: 'ダッシュボード', lane: 'flow', col: 1, row: 1 },
    { id: 'export', kind: 'answer', label: '書き出し', lane: 'flow', col: 0, row: 1 },
  ],
  edges: [
    { id: 'e-src-clean', from: 'source', to: 'clean' },
    { id: 'e-clean-tf', from: 'clean', to: 'transform' },
    { id: 'e-tf-model', from: 'transform', to: 'model', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-model-dash', from: 'model', to: 'dash', fromSide: 'left', toSide: 'right' },
    { id: 'e-dash-export', from: 'dash', to: 'export', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    { n: 1, short: '取り込み', caption: 'API や CSV、データベースから生のデータを取り込む', actions: [{ type: 'travel', particle: 'd', edges: ['e-src-clean'], payload: { kind: 'text', label: '生データ' } }] },
    { n: 2, short: '整える', caption: '欠損や重複を掃除し、集計しやすい形に変える', actions: [{ type: 'dwell', particle: 'd', node: 'clean', seconds: 0.6, label: '掃除中' }, { type: 'travel', particle: 'd', edges: ['e-clean-tf'], payload: { kind: 'text', label: '整った表' } }] },
    { n: 3, short: '学習', caption: '整ったデータでモデルを学習し、予測を出す', actions: [{ type: 'travel', particle: 'd', edges: ['e-tf-model'], payload: { kind: 'chunks', label: '集計', count: 3 } }, { type: 'dwell', particle: 'd', node: 'model', seconds: 0.7, label: '学習中' }] },
    {
      n: 4,
      short: '共有',
      caption: '予測をダッシュボードに描き、ファイルに書き出して共有する',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-model-dash'], payload: { kind: 'score', label: '予測' } },
        { type: 'travel', particle: 'd', edges: ['e-dash-export'], payload: { kind: 'image', label: '図' } },
        { type: 'end', particle: 'd', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [],
};
