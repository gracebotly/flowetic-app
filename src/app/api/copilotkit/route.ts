import { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";

function createRuntime() {
  const mastraAgents = MastraAgent.getLocalAgents({ mastra });

  return new CopilotRuntime({
    agents: mastraAgents,
  });
}

export const GET = async (req: NextRequest) => {
  const runtime = createRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: req.nextUrl.pathname,
  });

  return handleRequest(req);
};

export const POST = async (req: NextRequest) => {
  const runtime = createRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: req.nextUrl.pathname,
  });

  return handleRequest(req);
};
