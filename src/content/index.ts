import type { Composition } from '../model/diagram';
import { naiveRag } from './rag/naive';

export interface ContentEntry {
  composition: Composition;
  /** ギャラリーの見出しグループ */
  group: string;
}

export const content: ContentEntry[] = [
  { group: 'RAG', composition: { kind: 'single', id: 'naive-rag', diagram: naiveRag } },
];

export function findComposition(id: string | null | undefined): Composition {
  return content.find((c) => c.composition.id === id)?.composition ?? content[0].composition;
}
