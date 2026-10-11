import type { Composition } from '../model/diagram';
import { naiveRag } from './rag/naive';
import { hydeRag } from './rag/hyde';
import { correctiveRag } from './rag/corrective';
import { multimodalRag } from './rag/multimodal';
import { graphRag } from './rag/graph';
import { hybridRag } from './rag/hybrid';
import { adaptiveRag } from './rag/adaptive';
import { agenticRag } from './rag/agentic';

export interface ContentEntry {
  composition: Composition;
  /** ギャラリーの見出しグループ */
  group: string;
}

export const content: ContentEntry[] = [
  { group: 'RAG', composition: { kind: 'single', id: 'naive-rag', diagram: naiveRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'hyde-rag', diagram: hydeRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'corrective-rag', diagram: correctiveRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'multimodal-rag', diagram: multimodalRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'graph-rag', diagram: graphRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'hybrid-rag', diagram: hybridRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'adaptive-rag', diagram: adaptiveRag } },
  { group: 'RAG', composition: { kind: 'single', id: 'agentic-rag', diagram: agenticRag } },
];

export function findComposition(id: string | null | undefined): Composition {
  return content.find((c) => c.composition.id === id)?.composition ?? content[0].composition;
}
