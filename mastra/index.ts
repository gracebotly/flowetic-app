// Import Mastra from the submodule in v0.19.  
import { Mastra } from '@mastra/core/mastra';

import { masterRouterAgent } from './agents/masterRouterAgent';
import { platformMappingMaster } from './agents/platformMappingMaster';
import { dashboardBuilderAgent } from "./agents/dashboardBuilderAgent";
import { generatePreviewWorkflow } from './workflows/generatePreview';

export const mastra = new Mastra({
  telemetry: {
    enabled: false,
  },
  agents: {
    masterRouterAgent: masterRouterAgent,
    default: masterRouterAgent,
    platformMappingMaster: platformMappingMaster,
    dashboardBuilderAgent: dashboardBuilderAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
  },
});
