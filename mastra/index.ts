import { Mastra } from '@mastra/core';
import { masterRouterAgent } from './agents/masterRouter';
import { generatePreviewWorkflow } from './workflows/generatePreview';

export const mastra = new Mastra({
  agents: {
    masterRouter: masterRouterAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
  },
});
