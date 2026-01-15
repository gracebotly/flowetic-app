import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { mastra } from "@/mastra";
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  // Register Mastra agents
  const mastraAgents = MastraAgent.getLocalAgents({
    mastra,
  });

  // Inject the Vibe router agent explicitly
  const copilotRuntime = new CopilotRuntime({
    agents: {
      ...mastraAgents,
      vibe: vibeRouterAgent,
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
