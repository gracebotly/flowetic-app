// Import Mastra from the submodule in v0.19.  
import { Mastra } from '@mastra/core/mastra';
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
