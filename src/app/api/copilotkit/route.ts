import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";

export const POST = async (req: NextRequest) => {
  // Get local Mastra agents - using "platformMappingAgent" as the primary agent
  // This agent handles platform detection and dashboard template selection
  const mastraAgents = MastraAgent.getLocalAgents({
    mastra,
    agentId: "platformMappingAgent",
  });

  // Initialize CopilotKit runtime with Mastra agents
  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  // Create the Next.js App Router endpoint handler
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
