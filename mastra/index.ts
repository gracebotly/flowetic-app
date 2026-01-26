import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";


import { masterRouterAgent } from "./agents/masterRouterAgent";
import { platformMappingMaster } from "./agents/platformMappingMaster";
import { dashboardBuilderAgent } from "./agents/dashboardBuilderAgent";
import { designAdvisorAgent } from "./agents/designAdvisorAgent";

import { generatePreviewWorkflow } from "./workflows/generatePreview";
import { connectionBackfillWorkflow } from "./workflows/connectionBackfill";
import { deployDashboardWorkflow } from "./workflows/deployDashboard";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: process.env.MASTRA_STORAGE_URL || "file:./mastra.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  agents: {
    masterRouterAgent,
    platformMappingMaster,
    dashboardBuilderAgent,
    designAdvisorAgent,
    default: masterRouterAgent,
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
    connectionBackfill: connectionBackfillWorkflow,
    deployDashboard: deployDashboardWorkflow,
  },
});
