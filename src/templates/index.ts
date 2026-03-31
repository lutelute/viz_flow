export { dataPipeline } from './data-pipeline';
export { aiWorkflow } from './ai-workflow';
export { researchProcess } from './research-process';
export { networkInfra } from './network-infra';

import type { FlowDefinition } from '../core/types';
import { dataPipeline } from './data-pipeline';
import { aiWorkflow } from './ai-workflow';
import { researchProcess } from './research-process';
import { ragArchitectures } from './rag-architectures';
import { networkInfra } from './network-infra';

export const templateList: { name: string; key: string; flow: FlowDefinition }[] = [
  { name: 'Network (JS)', key: 'network-infra', flow: networkInfra },
  { name: 'Data Pipeline', key: 'data-pipeline', flow: dataPipeline },
  { name: 'RAG Pipeline', key: 'ai-workflow', flow: aiWorkflow },
  { name: 'Research Process', key: 'research-process', flow: researchProcess },
  ...ragArchitectures,
];
