// Import Mastra from the submodule in v0.19.  
import { Mastra } from '@mastra/core/mastra';
import { masterRouter } from './agents/masterRouter';
import { platformMappingMaster } from './agents/platformMappingMaster';
import { dashboardBuilderAgent } from "./agents/dashboardBuilderAgent";
import { designAdvisorAgent } from "./agents/designAdvisorAgent";
import { generatePreviewWorkflow } from './workflows/generatePreview';

export const mastra = new Mastra({
  agents: {
    masterRouter: masterRouter,
    default: masterRouter,
    platformMappingMaster: platformMappingMaster,
    dashboardBuilderAgent: dashboardBuilderAgent,
    designAdvisorAgent: designAdvisorAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
  },
});
