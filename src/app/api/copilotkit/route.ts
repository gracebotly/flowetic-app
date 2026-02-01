
import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  ExperimentalEmptyAdapter,
} from "@copilotkit/runtime";
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const POST = async (req: NextRequest) => {
  const copilotRuntime = new CopilotRuntime({
    agents: {
      default: vibeRouterAgent,
      vibe: vibeRouterAgent,
      vibeRouterAgent: vibeRouterAgent,
    },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};