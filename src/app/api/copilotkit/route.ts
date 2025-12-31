import { CopilotRuntime } from "@copilotkit/runtime";
import { copilotRuntimeHandler } from "@copilotkit/runtime/nextjs";
import { MastraPlatformMappingAdapter } from "@/lib/agents/mastra-copilotkit-adapter";

export const runtime = "nodejs";

// Create the agent adapter
const defaultAgent = new MastraPlatformMappingAdapter();

// Create CopilotRuntime with the agent
const copilotRuntime = new CopilotRuntime({
  agents: {
    default: defaultAgent,
  },
});

// Export GET and POST handlers
export const { GET, POST } = copilotRuntimeHandler(copilotRuntime);
