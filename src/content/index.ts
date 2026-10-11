import type { Composition } from '../model/diagram';
import { naiveRag } from './rag/naive';
import { multimodalRag } from './rag/multimodal';
import { hydeRag } from './rag/hyde';
import { correctiveRag } from './rag/corrective';
import { graphRag } from './rag/graph';
import { hybridRag } from './rag/hybrid';
import { adaptiveRag } from './rag/adaptive';
import { agenticRag } from './rag/agentic';
import { ragVsRefrag } from './rag/refrag';
import { hybridSearchRag } from './rag/hybrid-search';
import { selfRag } from './rag/self-rag';
import { network } from './infra/network';
import { dataPipeline } from './data/pipeline';
import { researchProcess } from './research/process';

export interface ContentEntry {
  composition: Composition;
  /** ギャラリーの見出しグループ */
  group: string;
}

const rag8 = [naiveRag, multimodalRag, hydeRag, correctiveRag, graphRag, hybridRag, adaptiveRag, agenticRag];

export const eightRag: Composition = {
  kind: 'grid',
  id: 'eight-rag',
  title: '8 つの RAG',
  columns: 4,
  cells: rag8.map((diagram) => ({ diagram })),
  sync: 'lockstep',
  sources: rag8.flatMap((d) => d.sources),
};

export const content: ContentEntry[] = [
  ...rag8.map((diagram) => ({ group: 'RAG', composition: { kind: 'single', id: diagram.id, diagram } as Composition })),
  { group: 'RAG', composition: eightRag },
  { group: 'RAG', composition: ragVsRefrag },
  { group: 'RAG の周辺', composition: { kind: 'single', id: hybridSearchRag.id, diagram: hybridSearchRag } },
  { group: 'RAG の周辺', composition: { kind: 'single', id: selfRag.id, diagram: selfRag } },
  { group: '仕組み', composition: { kind: 'single', id: network.id, diagram: network } },
  { group: '仕組み', composition: { kind: 'single', id: dataPipeline.id, diagram: dataPipeline } },
  { group: '仕組み', composition: { kind: 'single', id: researchProcess.id, diagram: researchProcess } },
];

export function findComposition(id: string | null | undefined): Composition {
  return content.find((c) => c.composition.id === id)?.composition ?? content[0].composition;
}
