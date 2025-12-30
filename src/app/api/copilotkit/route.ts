import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { platformMappingAgent } from "@/mastra/agents/platformMappingAgent";

// Create runtime with agent registration
const runtime = new CopilotRuntime({
  agents: [
    {
      name: "default",
      description: "Platform mapping agent for dashboard generation",
      agent: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]?.content || "";
        const response = await platformMappingAgent.generate(lastMessage);
        return {
          role: "assistant",
          content: response.text,
        };
      },
    },
  ],
});

// Use CopilotKit's standard endpoint handler
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: {
      // Add service adapter config if needed
    },
  });

  return handleRequest(req);
};

// Handle GET requests for runtime info
export const GET = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: {
      // Add service adapter config if needed
    },
  });

  return handleRequest(req);
};