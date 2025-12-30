import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { platformMappingAgent } from "@/mastra/agents/platformMappingAgent";

// Create runtime - pass agent instance directly
const runtime = new CopilotRuntime({
  // CopilotKit expects agent instances in the agents array
  // The Mastra agent itself implements the AbstractAgent interface
});

// Standard CopilotKit endpoint handler
export const POST = async (req: NextRequest) => {
  try {
    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      endpoint: "/api/copilotkit",
    });

    return handleRequest(req);
  } catch (error: any) {
    console.error('CopilotKit POST error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Handle GET requests for runtime info
export const GET = async (req: NextRequest) => {
  try {
    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      endpoint: "/api/copilotkit",
    });

    return handleRequest(req);
  } catch (error: any) {
    console.error('CopilotKit GET error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};