import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra/copilotkit";

import { mastraStorage } from "./lib/storage";

// IMPORTANT: keep your existing agent exports/imports.
// If you already define agents elsewhere, keep them and add them into `agents`.
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";
import { masterRouterAgent } from "./agents/masterRouterAgent";
import { platformMappingMaster } from "./agents/platformMappingMaster";
import { dashboardBuilderAgent } from "./agents/dashboardBuilderAgent";
import { designAdvisorAgent } from "./agents/designAdvisorAgent";

import { generatePreviewWorkflow } from "./workflows/generatePreview";
import { connectionBackfillWorkflow } from "./workflows/connectionBackfill";
import { deployDashboardWorkflow } from "./workflows/deployDashboard";

export const mastra = new Mastra({
  bundler: {
    externals: ["@copilotkit/runtime"],
  },

  storage: mastraStorage,

  agents: {
    // Agent id that CopilotKit will call
    vibeRouterAgent,
    
    // Keep existing agents
    masterRouterAgent,
    platformMappingMaster,
    dashboardBuilderAgent,
    designAdvisorAgent,
    
    // Optional: If your client still requests "default", you can keep an alias
    // by registering the same agent under another key (Mastra requires unique ids,
    // so we keep only the real id here and expose "default" from CopilotKit config below).
  },

  workflows: {
    generatePreview: generatePreviewWorkflow,
    connectionBackfill: connectionBackfillWorkflow,
    deployDashboard: deployDashboardWorkflow,
  },

  server: {
    cors: {
      origin: "*",
      allowMethods: ["*"],
      allowHeaders: ["*"],
    },

    apiRoutes: [
      registerCopilotKit({
        path: "/api/copilotkit",
        resourceId: "vibeRouterAgent",
      }),
    ],
  },
});
