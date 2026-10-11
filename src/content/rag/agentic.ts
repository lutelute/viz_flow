import type { Diagram } from '../../model/diagram';

// エージェント型 RAG。検索が固定の流れではなく、エージェントが計画・道具の選択・振り返りのループの中で
// 「いつ・どこから・何回」取るかを決める。MCP は検索手法ではなく、道具をつなぐ通信規約。

export const agenticRag: Diagram = {
  id: 'agentic-rag',
  title: 'エージェント型 RAG',
  subtitle: 'エージェントが計画し、道具を選んで呼び、結果を見て足りなければやり直す',
  lanes: [
    { id: 'agent', label: 'エージェントのループ', tone: 'accent2', frame: 'band' },
    { id: 'tools', label: 'MCP でつながる道具群', tone: 'accent1', frame: 'band' },
  ],
  nodes: [
    { id: 'user', kind: 'user', label: '質問', lane: 'agent', col: 0, row: 0 },
    { id: 'agent', kind: 'agent', label: 'エージェント', sublabel: '計画と振り返り', lane: 'agent', col: 1, row: 0, emphasis: 'new' },
    { id: 'memory', kind: 'memory', label: 'メモリ', sublabel: '短期と長期', lane: 'agent', col: 2, row: 1, emphasis: 'new' },
    { id: 'synth', kind: 'prompt', label: '統合', sublabel: '根拠をまとめる', lane: 'agent', col: 2, row: 0 },
    { id: 'answer', kind: 'answer', label: '回答', sublabel: '引用つき', lane: 'agent', col: 3, row: 0 },
    { id: 'mcp', kind: 'tool', label: 'MCP', sublabel: '道具との接続層', lane: 'tools', col: 1, row: 1, emphasis: 'new' },
    { id: 't-vec', kind: 'vectordb', label: 'ベクトル DB', lane: 'tools', col: 2, row: 0 },
    { id: 't-web', kind: 'web', label: 'Web 検索', lane: 'tools', col: 2, row: 1 },
    { id: 't-sql', kind: 'index', label: 'SQL', sublabel: '表のデータ', lane: 'tools', col: 2, row: 2 },
    { id: 'observe', kind: 'documents', label: '観測', sublabel: '返ってきた結果', lane: 'tools', col: 3, row: 1 },
  ],
  edges: [
    { id: 'e-user-agent', from: 'user', to: 'agent' },
    { id: 'e-agent-memory', from: 'agent', to: 'memory', role: 'ref', arrow: 'both', label: '読み書き' },
    { id: 'e-agent-mcp', from: 'agent', to: 'mcp', fromSide: 'left', toSide: 'left' },
    { id: 'e-mcp-vec', from: 'mcp', to: 't-vec', role: 'branch', branch: { group: 't', option: 'vec' } },
    { id: 'e-mcp-web', from: 'mcp', to: 't-web', role: 'branch', branch: { group: 't', option: 'web' } },
    { id: 'e-mcp-sql', from: 'mcp', to: 't-sql', role: 'branch', branch: { group: 't', option: 'sql' } },
    { id: 'e-vec-obs', from: 't-vec', to: 'observe' },
    { id: 'e-web-obs', from: 't-web', to: 'observe' },
    { id: 'e-sql-obs', from: 't-sql', to: 'observe' },
    { id: 'e-obs-agent', from: 'observe', to: 'agent', fromSide: 'top', toSide: 'bottom' },
    { id: 'e-agent-synth', from: 'agent', to: 'synth' },
    { id: 'e-synth-answer', from: 'synth', to: 'answer' },
  ],
  steps: [
    {
      n: 1,
      short: '計画',
      caption: '質問をサブタスクに分解して計画を立てる。メモリの過去のやり取りも見る',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-user-agent'], payload: { kind: 'query', label: '質問' } },
        { type: 'dwell', particle: 'q', node: 'agent', seconds: 0.8, label: '計画中' },
        { type: 'highlight', nodes: ['memory'], edges: ['e-agent-memory'] },
      ],
    },
    {
      n: 2,
      short: '道具を呼ぶ',
      caption: 'サブタスクごとに道具を選び、MCP 経由で呼ぶ。どの道具を何回呼ぶかは固定ではない',
      actions: [
        { type: 'travel', particle: 'q', edges: ['e-agent-mcp'], payload: { kind: 'plan', label: '道具呼び出し' } },
        {
          type: 'split',
          particle: 'q',
          at: 'mcp',
          into: [
            { particle: 'c1', payload: { kind: 'plan', label: '検索', tone: 'accent1' } },
            { particle: 'c2', payload: { kind: 'plan', label: '検索', tone: 'accent1' } },
            { particle: 'c3', payload: { kind: 'plan', label: '問い合わせ', tone: 'accent1' } },
          ],
        },
        { type: 'travel', particle: 'c1', edges: ['e-mcp-vec'], payload: { kind: 'plan', label: '検索', tone: 'accent1' } },
        { type: 'travel', particle: 'c2', edges: ['e-mcp-web'], payload: { kind: 'plan', label: '検索', tone: 'accent1' } },
        { type: 'travel', particle: 'c3', edges: ['e-mcp-sql'], payload: { kind: 'plan', label: '問い合わせ', tone: 'accent1' } },
      ],
    },
    {
      n: 3,
      short: '観測',
      caption: '各道具から返ってきた結果（文書・ページ・表の行）を受け取る',
      actions: [
        { type: 'travel', particle: 'c1', edges: ['e-vec-obs'], payload: { kind: 'chunks', label: '文書', count: 3 } },
        { type: 'travel', particle: 'c2', edges: ['e-web-obs'], payload: { kind: 'chunks', label: 'ページ', count: 3 } },
        { type: 'travel', particle: 'c3', edges: ['e-sql-obs'], payload: { kind: 'text', label: '表の行' } },
        { type: 'merge', particles: ['c1', 'c2', 'c3'], at: 'observe', into: { particle: 'o', payload: { kind: 'chunks', label: '結果', count: 3 } } },
        { type: 'travel', particle: 'o', edges: ['e-obs-agent'], payload: { kind: 'chunks', label: '結果', count: 3 } },
      ],
    },
    {
      n: 4,
      short: '振り返り',
      caption: '結果で足りるか自分で評価する。足りなければ計画を直して②に戻る',
      actions: [
        { type: 'dwell', particle: 'o', node: 'agent', seconds: 1.0, label: '振り返り' },
        { type: 'highlight', nodes: ['memory'], edges: ['e-agent-memory', 'e-agent-mcp'] },
      ],
    },
    {
      n: 5,
      short: '統合',
      caption: '足りたら根拠をまとめ、どの道具から得たかの引用を付けて回答する',
      actions: [
        { type: 'travel', particle: 'o', edges: ['e-agent-synth'], payload: { kind: 'prompt', label: '根拠' } },
        { type: 'travel', particle: 'o', edges: ['e-synth-answer'], payload: { kind: 'answer', label: '回答' } },
        { type: 'end', particle: 'o', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  layout: { rowHeight: 130, laneGap: 52 },
  sources: [
    {
      title: 'Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG',
      authors: 'Singh, A., Ehtesham, A., Kumar, S., Khoei, T. T.',
      year: 2025,
      arxiv: '2501.09136',
      note: '計画・道具の使用・振り返り・複数エージェントの 4 パターンはこの survey の 2 節。survey は MCP に触れていない',
    },
    {
      title: 'Introducing the Model Context Protocol',
      authors: 'Anthropic',
      year: 2024,
      url: 'https://www.anthropic.com/news/model-context-protocol',
      note: 'MCP はエージェントと道具（検索・DB・ファイル）の間の通信規約。図では接続層として描いている',
    },
  ],
};
