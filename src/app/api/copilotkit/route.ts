import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { vibeRouterAgent } from "@/lib/copilotkit/vibe-router-agent";

export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  // Inject the Vibe router agent explicitly
  const copilotRuntime = new CopilotRuntime({
    agents: {
      // Alias for clients/components that default to "default"
      default: vibeRouterAgent,

      // Canonical Flowetic agent id
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

export const OPTIONS = async () => new Response(null, { status: 204 });
