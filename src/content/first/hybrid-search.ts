import type { Diagram } from '../../model/diagram';
import { hybridSearchRag } from '../rag/hybrid-search';
import { flowLane } from './lane';

// 最初の版の「Hybrid RAG」を略図で描き直したもの。中身は密な検索と疎な検索を合わせる
// 「ハイブリッド検索」だったので、その名前にした（HybridRAG 論文のベクトル＋グラフとは別物）。
// 2 つの結果は元の版の再ランクではなく、RRF で順位だけを使って融合する（Cormack ほか 2009）。

export const firstHybridSearch: Diagram = {
  id: 'first-hybrid-search',
  title: 'ハイブリッド検索',
  subtitle: '意味の近さと語の一致の 2 通りで探し、順位を融合する',
  detail: hybridSearchRag.id,
  lanes: flowLane,
  nodes: [
    { id: 'vec', kind: 'vectordb', label: 'ベクトル検索', sublabel: '意味が近い', lane: 'flow', col: 1, row: 0, opens: 'inside-vectordb' },
    { id: 'user', kind: 'user', label: '質問', lane: 'flow', col: 0, row: 1 },
    { id: 'rrf', kind: 'reranker', label: 'RRF で融合', lane: 'flow', col: 2, row: 1, opens: 'inside-rrf' },
    { id: 'llm', kind: 'llm', label: 'LLM', lane: 'flow', col: 3, row: 1, opens: 'inside-llm' },
    { id: 'bm25', kind: 'index', label: 'BM25 検索', sublabel: '語が一致する', lane: 'flow', col: 1, row: 2 },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'flow', col: 3, row: 2 },
  ],
  edges: [
    { id: 'e-user-vec', from: 'user', to: 'vec', fromSide: 'right', toSide: 'left', role: 'branch', branch: { group: 's', option: 'vec' } },
    { id: 'e-user-bm25', from: 'user', to: 'bm25', fromSide: 'right', toSide: 'left', role: 'branch', branch: { group: 's', option: 'bm25' } },
    { id: 'e-vec-rrf', from: 'vec', to: 'rrf' },
    { id: 'e-bm25-rrf', from: 'bm25', to: 'rrf' },
    { id: 'e-rrf-llm', from: 'rrf', to: 'llm', label: '上位の文書' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    {
      n: 1,
      short: '2 通り',
      caption: '同じ質問で、意味の近さ（ベクトル）と語の一致（BM25）の 2 通りに検索する',
      actions: [
        { type: 'travel', particle: 'a', edges: ['e-user-vec'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'b', edges: ['e-user-bm25'], payload: { kind: 'query', label: '質問' } },
      ],
    },
    {
      n: 2,
      short: '順位表',
      caption: 'どちらの検索も、文書を近い順に並べた順位表を返す。点数の尺度は 2 つで違う',
      actions: [
        { type: 'travel', particle: 'a', edges: ['e-vec-rrf'], payload: { kind: 'chunks', label: '順位表', count: 3 } },
        { type: 'travel', particle: 'b', edges: ['e-bm25-rrf'], payload: { kind: 'chunks', label: '順位表', count: 3 } },
      ],
    },
    {
      n: 3,
      short: '融合',
      caption: 'RRF が点数を捨てて順位だけを使い、2 つの順位表を 1 つにまとめる',
      badge: { node: 'rrf', corner: 'ne' },
      actions: [
        { type: 'merge', particles: ['a', 'b'], at: 'rrf', into: { particle: 'p', payload: { kind: 'chunks', label: '上位の文書', count: 3 } } },
        { type: 'travel', particle: 'p', edges: ['e-rrf-llm'], payload: { kind: 'chunks', label: '上位の文書', count: 3 } },
      ],
    },
    {
      n: 4,
      short: '生成',
      caption: 'LLM が質問と上位の文書から回答を書く',
      actions: [
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: hybridSearchRag.sources,
};
