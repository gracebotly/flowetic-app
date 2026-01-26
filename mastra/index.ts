import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra/copilotkit";

import { mastraStorage } from "./lib/storage";

// This agent already exists in your app and is the one you want CopilotKit to talk to.
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const mastra = new Mastra({
  bundler: {
    externals: ["@copilotkit/runtime"],
  },

  storage: mastraStorage,

  agents: {
    vibeRouterAgent,
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
