import type { Diagram } from '../../model/diagram';
import { firstNaive } from './naive';
import { firstMultimodal } from './multimodal';
import { firstHyde } from './hyde';
import { firstCorrective } from './corrective';
import { firstGraph } from './graph';
import { firstHybridSearch } from './hybrid-search';
import { firstAdaptive } from './adaptive';
import { firstAgentic } from './agentic';
import { firstPipeline } from './pipeline';
import { firstResearch } from './research';

// 最初の版（2026-03-30）の図を、部品の少なさと形はそのままに、日本語と論文どおりの中身で描き直したもの。
// 元の版の「RAG Pipeline」は、誤りを直すと「基本の RAG」と同じ図になるので入れていない。

export const firstDiagrams: Diagram[] = [
  firstNaive,
  firstMultimodal,
  firstHyde,
  firstCorrective,
  firstGraph,
  firstHybridSearch,
  firstAdaptive,
  firstAgentic,
  firstPipeline,
  firstResearch,
];
