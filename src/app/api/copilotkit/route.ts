import { CopilotRuntime, copilotRuntimeHandler } from "@copilotkit/runtime";

import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime({
  agents: {
    vibe: vibeRouterAgent,
  },
});

export const { GET, POST } = copilotRuntimeHandler(copilotRuntime);
