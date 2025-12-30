import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";

export const POST = async (req: NextRequest) => {
  // Get local Mastra agents (API does NOT support agentId option in this version)
  const mastraAgents = MastraAgent.getLocalAgents({ mastra });

  // Optional: fail fast if the expected primary agent is not registered
  const hasPlatformMappingAgent =
    typeof mastraAgents === "object" &&
    mastraAgents !== null &&
    "platformMappingAgent" in (mastraAgents as Record<string, unknown>);

  if (!hasPlatformMappingAgent) {
    return new Response(
      JSON.stringify({
        type: "error",
        code: "AGENT_NOT_FOUND",
        message:
          "platformMappingAgent is not registered in mastra. Check mastra/index.ts agents registration.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
