import type { Diagram } from '../../model/diagram';

// ハイブリッド検索（密＋疎）。同じ質問を意味の近さ（ベクトル）と語の一致（BM25）の 2 つの検索器に掛け、
// 順位だけを使う RRF で融合する。「HybridRAG（ベクトル＋グラフ）」とは別物。

export const hybridSearchRag: Diagram = {
  id: 'hybrid-search',
  title: 'ハイブリッド検索（密と疎）',
  subtitle: '意味の近さと語の一致の 2 つで検索し、順位を融合してから答える',
  lanes: [
    { id: 'index', label: '索引づくり（2 種類の索引）', tone: 'accent1', frame: 'band' },
    { id: 'query', label: '質問に答える（2 つの検索と融合）', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'docs', kind: 'documents', label: '文書群', lane: 'index', col: 0, row: 0, emphasis: 'muted' },
    { id: 'chunker', kind: 'chunker', label: 'チャンク\n分割', lane: 'index', col: 1, row: 0, emphasis: 'muted', opens: 'inside-chunker' },
    { id: 'embed', kind: 'embedding', label: '埋め込み\nモデル', lane: 'index', col: 2, row: 0, emphasis: 'muted', opens: 'inside-embedding' },
    { id: 'vindex', kind: 'vectordb', label: 'ベクトル索引', sublabel: '密: 意味の近さ', lane: 'index', col: 3, row: 0, opens: 'inside-vectordb' },
    { id: 'bm25', kind: 'index', label: '転置索引', sublabel: '疎: 語の一致（BM25）', lane: 'index', col: 2, row: 1, emphasis: 'new' },
    { id: 'llm', kind: 'llm', label: 'LLM', sublabel: '回答を書く', lane: 'query', col: 0, row: 0, opens: 'inside-llm' },
    { id: 'answer', kind: 'answer', label: '回答', lane: 'query', col: 0, row: 1 },
    { id: 'rrf', kind: 'reranker', label: 'RRF で融合', sublabel: '1/(60+順位) の和', lane: 'query', col: 1, row: 0, emphasis: 'new', opens: 'inside-rrf' },
    { id: 'user', kind: 'user', label: '質問', lane: 'query', col: 1, row: 1 },
    { id: 'ssearch', kind: 'retriever', label: 'BM25 検索', sublabel: '固有名詞や型番に強い', lane: 'query', col: 2, row: 1, emphasis: 'new' },
    { id: 'vsearch', kind: 'retriever', label: 'ベクトル\n検索', sublabel: '言い換えに強い', lane: 'query', col: 3, row: 0 },
  ],
  edges: [
    { id: 'e-docs-chunk', from: 'docs', to: 'chunker' },
    { id: 'e-chunk-embed', from: 'chunker', to: 'embed' },
    { id: 'e-embed-vindex', from: 'embed', to: 'vindex' },
    { id: 'e-chunk-bm25', from: 'chunker', to: 'bm25', fromSide: 'bottom', toSide: 'left' },
    { id: 'e-vindex-vsearch', from: 'vindex', to: 'vsearch', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-bm25-ssearch', from: 'bm25', to: 'ssearch', fromSide: 'bottom', toSide: 'top' },
    { id: 'e-user-vsearch', from: 'user', to: 'vsearch', fromSide: 'right', toSide: 'left' },
    { id: 'e-user-ssearch', from: 'user', to: 'ssearch', fromSide: 'right', toSide: 'left' },
    { id: 'e-vsearch-rrf', from: 'vsearch', to: 'rrf', fromSide: 'left', toSide: 'right' },
    { id: 'e-ssearch-rrf', from: 'ssearch', to: 'rrf', fromSide: 'left', toSide: 'right' },
    { id: 'e-rrf-llm', from: 'rrf', to: 'llm', fromSide: 'left', toSide: 'right' },
    { id: 'e-llm-answer', from: 'llm', to: 'answer', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    { n: 1, short: '分割', caption: '文書をチャンクに分ける', actions: [{ type: 'travel', particle: 'd', edges: ['e-docs-chunk'], payload: { kind: 'text', label: '文書' } }] },
    {
      n: 2,
      short: '密の索引',
      caption: 'チャンクを埋め込みモデルでベクトルにし、ベクトル索引に入れる',
      actions: [
        { type: 'travel', particle: 'd', edges: ['e-chunk-embed'], payload: { kind: 'chunks', label: '文書×3', count: 3 } },
        { type: 'travel', particle: 'd', edges: ['e-embed-vindex'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 'd', mode: 'absorb' },
      ],
    },
    {
      n: 3,
      short: '疎の索引',
      caption: '同じチャンクを語に分け、どの語がどのチャンクにあるかの転置索引も作る',
      actions: [
        { type: 'travel', particle: 's', edges: ['e-chunk-bm25'], payload: { kind: 'tokens', label: '語の一覧' } },
        { type: 'end', particle: 's', mode: 'absorb' },
      ],
    },
    {
      n: 4,
      short: 'ベクトル検索',
      caption: '質問をベクトルにして意味の近いチャンクを探し、順位 A を得る',
      actions: [
        { type: 'travel', particle: 'qa', edges: ['e-user-vsearch'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'ra', edges: ['e-vindex-vsearch'], payload: { kind: 'chunks', label: '候補', count: 3 } },
        { type: 'merge', particles: ['qa', 'ra'], at: 'vsearch', into: { particle: 'la', payload: { kind: 'score', label: '順位 A' } } },
      ],
    },
    {
      n: 5,
      short: 'BM25 検索',
      caption: '同じ質問を語の一致で検索し、順位 B を得る。型番や人名のような言い換えの効かない語に強い',
      actions: [
        { type: 'travel', particle: 'qb', edges: ['e-user-ssearch'], payload: { kind: 'query', label: '質問' } },
        { type: 'travel', particle: 'rb', edges: ['e-bm25-ssearch'], payload: { kind: 'chunks', label: '候補', count: 3 } },
        { type: 'merge', particles: ['qb', 'rb'], at: 'ssearch', into: { particle: 'lb', payload: { kind: 'score', label: '順位 B' } } },
      ],
    },
    {
      n: 6,
      short: '融合',
      caption: '2 つの順位を RRF で融合する。点数の尺度が違っても、順位だけを使うので混ぜられる',
      actions: [
        { type: 'travel', particle: 'la', edges: ['e-vsearch-rrf'], payload: { kind: 'score', label: '順位 A' } },
        { type: 'travel', particle: 'lb', edges: ['e-ssearch-rrf'], payload: { kind: 'score', label: '順位 B', tone: 'accent3' } },
        { type: 'merge', particles: ['la', 'lb'], at: 'rrf', into: { particle: 'p', payload: { kind: 'chunks', label: '上位 K 件', count: 3 } } },
        { type: 'dwell', particle: 'p', node: 'rrf', seconds: 0.6, label: '融合中' },
      ],
    },
    {
      n: 7,
      short: '生成',
      caption: '融合した上位 K 件を根拠に LLM が回答を書く。必要なら間に再ランクを挟む',
      actions: [
        { type: 'travel', particle: 'p', edges: ['e-rrf-llm'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'dwell', particle: 'p', node: 'llm', seconds: 0.8, label: '生成中' },
        { type: 'travel', particle: 'p', edges: ['e-llm-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 150, laneGap: 56 },
  sources: [
    {
      title: 'Reciprocal rank fusion outperforms Condorcet and individual rank learning methods',
      authors: 'Cormack, G. V., Clarke, C. L. A., Büttcher, S.',
      year: 2009,
      venue: 'SIGIR 2009',
      doi: '10.1145/1571941.1572114',
      note: 'RRF の式 Σ 1/(k+順位)、k=60 はこの論文',
    },
    {
      title: 'Retrieval-Augmented Generation for Large Language Models: A Survey',
      authors: 'Gao, Y. ほか',
      year: 2023,
      arxiv: '2312.10997',
      note: 'Modular RAG の「Hybrid retrieval」パターンがこの図。ベクトル＋グラフの HybridRAG（Sarmah ほか 2024）とは別',
    },
  ],
};
