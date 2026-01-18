// Import Mastra from the submodule in v0.19.  
import { Mastra } from '@mastra/core/mastra';

import { masterRouterAgent } from './agents/masterRouterAgent';
import { platformMappingMaster } from './agents/platformMappingMaster';
import { dashboardBuilderAgent } from "./agents/dashboardBuilderAgent";
import { designAdvisorAgent } from "./agents/designAdvisorAgent";
import { generatePreviewWorkflow } from './workflows/generatePreview';

export const mastra = new Mastra({
  telemetry: {
    serviceName: 'flowetic-mastra',
    sampling: { type: 'ratio', probability: 0 },
  },
  agents: {
    masterRouterAgent: masterRouterAgent,
    default: masterRouterAgent,
    platformMappingMaster: platformMappingMaster,
    dashboardBuilderAgent: dashboardBuilderAgent,
    designAdvisorAgent: designAdvisorAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
  },
});
