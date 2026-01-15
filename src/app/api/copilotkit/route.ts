import { CopilotRuntime } from "@copilotkit/runtime";
import { copilotRuntimeHandler } from "@copilotkit/runtime/nextjs";

import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime({
  agents: {
    vibe: vibeRouterAgent,
  },
});

export const { GET, POST } = copilotRuntimeHandler(copilotRuntime);
