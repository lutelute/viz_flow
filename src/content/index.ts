import { diagramsOf, type Composition } from '../model/diagram';
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
import { ircot } from './rag/ircot';
import { ragFusion } from './rag/rag-fusion';
import { speculativeRag } from './rag/speculative';
import { network } from './infra/network';
import { dataPipeline } from './data/pipeline';
import { researchProcess } from './research/process';
import { layers } from './layers';

export interface ContentEntry {
  composition: Composition;
  /** ギャラリーの見出しグループ */
  group: string;
  /** 「ひらく」で入る中身の図。ギャラリーの印を変える */
  layer?: boolean;
}

export const LAYER_GROUP = '部品の中';

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
  { group: 'RAG の周辺', composition: { kind: 'single', id: ircot.id, diagram: ircot } },
  { group: 'RAG の周辺', composition: { kind: 'single', id: ragFusion.id, diagram: ragFusion } },
  { group: 'RAG の周辺', composition: { kind: 'single', id: speculativeRag.id, diagram: speculativeRag } },
  { group: '仕組み', composition: { kind: 'single', id: network.id, diagram: network } },
  { group: '仕組み', composition: { kind: 'single', id: dataPipeline.id, diagram: dataPipeline } },
  { group: '仕組み', composition: { kind: 'single', id: researchProcess.id, diagram: researchProcess } },
  ...layers.map((diagram) => ({ group: LAYER_GROUP, layer: true, composition: { kind: 'single', id: diagram.id, diagram } as Composition })),
];

/** 一覧や比較の中の 1 枚も、単体の図として引けるようにする（書き出しで使う）。 */
const inner = new Map<string, Composition>();
for (const e of content) {
  for (const d of diagramsOf(e.composition)) {
    if (!inner.has(d.id)) inner.set(d.id, { kind: 'single', id: d.id, diagram: d });
  }
}

export function hasComposition(id: string | null | undefined): boolean {
  return !!id && (content.some((c) => c.composition.id === id) || inner.has(id));
}

export function findComposition(id: string | null | undefined): Composition {
  if (!id) return content[0].composition;
  return content.find((c) => c.composition.id === id)?.composition ?? inner.get(id) ?? content[0].composition;
}
