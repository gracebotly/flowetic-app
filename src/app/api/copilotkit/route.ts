
import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  ExperimentalEmptyAdapter,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { mastra } from "@/mastra";

export const POST = async (req: NextRequest) => {
  // Use MastraAgent.getLocalAgents() to wrap agents for AG-UI protocol
  const mastraAgents = MastraAgent.getLocalAgents({
    mastra,
    agentId: "vibeRouterAgent",
  });

  const copilotRuntime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};