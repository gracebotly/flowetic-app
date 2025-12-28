import { Mastra } from '@mastra/core';
import { masterRouterAgent } from './agents/masterRouter';
import { generatePreviewWorkflow } from './workflows/generatePreview';
import { analyzeSchema } from './tools/analyzeSchema';
import { selectTemplate } from './tools/selectTemplate';
import { generateMapping } from './tools/generateMapping';
import { generateUISpec } from './tools/generateUISpec';
import { validateSpec } from './tools/validateSpec';
import { persistPreviewVersion } from './tools/persistPreviewVersion';

export const mastra = new Mastra({
  agents: {
    masterRouter: masterRouterAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
  },
  tools: {
    analyzeSchema,
    selectTemplate,
    generateMapping,
    generateUISpec,
    validateSpec,
    persistPreviewVersion,
  },
});
