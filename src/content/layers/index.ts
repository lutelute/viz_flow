import type { Diagram, DiagramNode } from '../../model/diagram';
import { insideChunker } from './chunker';
import { insideEmbedding } from './embedding';
import { insideAttention } from './attention';
import { insideVectordb } from './vectordb';
import { insidePrompt } from './prompt';
import { insideLlm } from './llm';
import { insideRrf } from './rrf';

// 「ひらく」で入る一段下の図。外の図のノードが opens でここの id を指す。
// 中の図の左右の port ノードは、外の図でそのノードに入ってくるものと出ていくものに合わせてある。

export const layers: Diagram[] = [insideChunker, insideEmbedding, insideAttention, insideVectordb, insidePrompt, insideLlm, insideRrf];

const byId = new Map(layers.map((d) => [d.id, d]));

export function findLayer(id: string | null | undefined): Diagram | null {
  return (id && byId.get(id)) || null;
}

export function layerOf(node: DiagramNode): Diagram | null {
  return findLayer(node.opens);
}
