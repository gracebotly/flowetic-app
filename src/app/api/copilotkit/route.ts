
import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  ExperimentalEmptyAdapter,
} from "@copilotkit/runtime";
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const POST = async (req: NextRequest) => {
  console.log("[CopilotKit Route] POST request received");
  
  const copilotRuntime = new CopilotRuntime({
    agents: {
      default: vibeRouterAgent,
      vibe: vibeRouterAgent,
      vibeRouterAgent: vibeRouterAgent,
    },
  });

  console.log("[CopilotKit Route] CopilotRuntime created");

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  console.log("[CopilotKit Route] Calling handleRequest");
  const response = await handleRequest(req);
  console.log("[CopilotKit Route] handleRequest completed, status:", response.status);
  
  return response;
};