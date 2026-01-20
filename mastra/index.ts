// Import Mastra from the submodule in v0.19.  
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { masterRouterAgent } from './agents/masterRouterAgent';
import { platformMappingMaster } from './agents/platformMappingMaster';
import { dashboardBuilderAgent } from "./agents/dashboardBuilderAgent";
import { designAdvisorAgent } from "./agents/designAdvisorAgent";
import { generatePreviewWorkflow } from './workflows/generatePreview';

export const mastra = new Mastra({
  telemetry: {
    enabled: true,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
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
