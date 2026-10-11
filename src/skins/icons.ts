import type { NodeKind, PayloadKind } from '../model/diagram';

// 図記号。24×24 の線画。線幅と色はスキンが決める。
// lucide の流用ではなく、ノードの意味がそのまま形になるように描いている。

export const NODE_GLYPHS: Record<NodeKind, string[]> = {
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'],
  query: ['M4 4h16v11H9l-5 4V4Z', 'M10.3 8.4a1.9 1.9 0 1 1 2.6 1.8c-.7.3-.9.8-.9 1.4', 'M12 13.6v.2'],
  documents: ['M8 3h7l4 4v11H8V3Z', 'M15 3v4h4', 'M10 10h6M10 13h6M10 16h4', 'M5 7v14h11'],
  chunker: ['M5 4h14v5H5V4Z', 'M5 11h6v9H5v-9Z', 'M13 11h6v9h-6v-9Z'],
  embedding: ['M4 7v10', 'M20 7v10', 'M7 10h2.4v4H7v-4Z', 'M10.8 10h2.4v4h-2.4v-4Z', 'M14.6 10H17v4h-2.4v-4Z'],
  vectordb: [
    'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Z',
    'M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6',
    'M9 12v.2M13.5 11v.2M11 15.5v.2M15.5 15v.2M8 16v.2',
  ],
  graphdb: [
    'M6 7a2 2 0 1 0 0 .01Z', 'M18 7a2 2 0 1 0 0 .01Z', 'M12 18a2 2 0 1 0 0 .01Z',
    'M8 7h8', 'M7 8.8l4 7.4', 'M17 8.8l-4 7.4',
  ],
  retriever: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'M15.3 15.3 21 21', 'M8 9h5M8 12h3'],
  reranker: ['M9 6h11M9 12h11M9 18h11', 'M4.5 4v16', 'M2.5 6l2-2 2 2', 'M2.5 18l2 2 2-2'],
  grader: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8 12.5l2.8 2.8L16.5 9'],
  router: ['M3 19h18', 'M9 19c3 0 3.5-5 5.5-8s4.5-5 6.5-5', 'M13 13h8'],
  prompt: [
    'M6 3h12v18H6V3Z',
    'M10 7.5c-1 0-1.2.6-1.2 1.6v1.3c0 .9-.6 1.3-1.3 1.6.7.3 1.3.7 1.3 1.6v1.3c0 1 .2 1.6 1.2 1.6',
    'M14 7.5c1 0 1.2.6 1.2 1.6v1.3c0 .9.6 1.3 1.3 1.6-.7.3-1.3.7-1.3 1.6v1.3c0 1-.2 1.6-1.2 1.6',
  ],
  llm: ['M4 15.5h16v4.5H4v-4.5Z', 'M4 9.75h16v4.5H4v-4.5Z', 'M4 4h16v4.5H4V4Z', 'M7 6.2v.1M7 12v.1M7 17.7v.1'],
  answer: ['M4 4h16v11H9l-5 4V4Z', 'M8 8h8M8 11h5', 'M14 11.5l1.5 1.5 3-3'],
  web: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18', 'M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18'],
  tool: ['M14.5 6.5a4 4 0 0 0-5.3 5L4 16.7 7.3 20l5.2-5.2a4 4 0 0 0 5-5.3l-2.4 2.4-2.1-.5-.5-2.1 2.4-2.4Z'],
  agent: ['M5 8h14v11H5V8Z', 'M9 13v.2M15 13v.2', 'M12 8V5', 'M12 4a1 1 0 1 0 0 .01Z', 'M9 16.5h6'],
  memory: ['M5 3h14v18H5V3Z', 'M9 3v18', 'M12.5 8h4M12.5 12h4M12.5 16h2.5'],
  policy: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 12l4.5-4.5', 'M12 12v.2', 'M6 15h2M16 15h2'],
  encoder: ['M4 5h16l-5.5 6.5V18l-5 2.5v-9L4 5Z'],
  index: ['M4 7h16v13H4V7Z', 'M4 11h16', 'M8 7V4h8v3', 'M10 15h4'],
  image: ['M4 5h16v14H4V5Z', 'M4 16l5-5 4 4 3-3 4 4', 'M15.5 9a1 1 0 1 0 0 .01Z'],
  generic: ['M5 5h14v14H5V5Z'],
};

export const PAYLOAD_GLYPHS: Record<PayloadKind, string[]> = {
  text: ['M5 4h14v16H5V4Z', 'M8 9h8M8 12h8M8 15h5'],
  query: ['M4 4h16v11H9l-5 4V4Z', 'M10.3 8.4a1.9 1.9 0 1 1 2.6 1.8c-.7.3-.9.8-.9 1.4', 'M12 13.6v.2'],
  vector: ['M4 7v10', 'M20 7v10', 'M7 10h2.4v4H7v-4Z', 'M10.8 10h2.4v4h-2.4v-4Z', 'M14.6 10H17v4h-2.4v-4Z'],
  chunks: ['M8 3h11v13H8V3Z', 'M5 7h11v13H5V7Z', 'M8 11h5M8 14h5'],
  prompt: [
    'M6 3h12v18H6V3Z',
    'M10 7.5c-1 0-1.2.6-1.2 1.6v1.3c0 .9-.6 1.3-1.3 1.6.7.3 1.3.7 1.3 1.6v1.3c0 1 .2 1.6 1.2 1.6',
    'M14 7.5c1 0 1.2.6 1.2 1.6v1.3c0 .9.6 1.3 1.3 1.6-.7.3-1.3.7-1.3 1.6v1.3c0 1-.2 1.6-1.2 1.6',
  ],
  answer: ['M4 4h16v11H9l-5 4V4Z', 'M8 11.5l2.2 2.2L15 9'],
  image: ['M4 5h16v14H4V5Z', 'M4 16l5-5 4 4 3-3 4 4', 'M15.5 9a1 1 0 1 0 0 .01Z'],
  graph: ['M6 8a2 2 0 1 0 0 .01Z', 'M18 8a2 2 0 1 0 0 .01Z', 'M12 18a2 2 0 1 0 0 .01Z', 'M8 8h8M7 9.8l4 6.4M17 9.8l-4 6.4'],
  score: ['M4 18a8 8 0 0 1 16 0', 'M12 18l4-6', 'M12 18v.2'],
  plan: ['M5 4h14v16H5V4Z', 'M8 9l1.5 1.5L12 8', 'M8 14l1.5 1.5L12 13', 'M14 9h3M14 14h3'],
  tokens: ['M3 10h3v4H3zM7.5 10h3v4h-3zM12 10h3v4h-3zM16.5 10h3v4h-3z'],
  compressed: ['M7 7h10v10H7V7Z', 'M9 9h6v6H9V9Z'],
  generic: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z'],
};

export function nodeGlyph(kind: NodeKind, override?: string): string[] {
  if (override && override in NODE_GLYPHS) return NODE_GLYPHS[override as NodeKind];
  return NODE_GLYPHS[kind] ?? NODE_GLYPHS.generic;
}

export function payloadGlyph(kind: PayloadKind): string[] {
  return PAYLOAD_GLYPHS[kind] ?? PAYLOAD_GLYPHS.generic;
}
