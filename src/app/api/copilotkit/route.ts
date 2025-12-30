import { CopilotRuntime } from "@copilotkit/runtime";
import { NextRequest, NextResponse } from "next/server";
import { platformMappingAgent } from "@/mastra/agents/platformMappingAgent";

const copilotKit = new CopilotRuntime({
  actions: [
    // Platform mapping actions will be automatically registered from ChatWorkspace component
  ],
});

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Check if this is a workflow trigger request
    if (lastMessage.toLowerCase().includes("generate preview") || 
        lastMessage.toLowerCase().includes("preview") ||
        lastMessage.toLowerCase().includes("create dashboard")) {
      
      // Extract request context from previous messages or metadata
      const contextMessage = messages.find((msg: any) => msg.content.includes('{') && msg.content.includes('tenantId'));
      let body: any = {};
      
      if (contextMessage) {
        try {
          body = JSON.parse(contextMessage.content);
        } catch (e) {
          // If parsing fails, try to extract from user message
          console.log('Could not parse context message, using defaults');
        }
      }

      // Use default context for MVP if not provided
      const tenantId = body.tenantId || 'demo-tenant';
      const userId = body.userId || 'demo-user';
      const interfaceId = body.interfaceId || `demo-interface-${Date.now()}`;

      // Validate required fields
      if (!tenantId || !userId || !interfaceId) {
        return NextResponse.json({
          error: "MISSING_CONTEXT",
          message: "Missing required context: tenantId, userId, and interfaceId",
        }, { status: 400 });
      }

      // Use the platform mapping agent to handle the request
      const response = await platformMappingAgent.generate(lastMessage);

      return NextResponse.json({
        type: 'agent_response',
        content: response.text,
        context: {
          tenantId,
          userId,
          interfaceId,
        },
      });
    }

    // Default CopilotKit behavior for regular chat - simplified for now
    return NextResponse.json({ message: "Chat functionality temporarily disabled" });
  } catch (error: any) {
    console.error('CopilotKit route error:', error);
    return NextResponse.json({
      error: "AGENT_ERROR",
      message: "Failed to process request",
      details: error.message,
    }, { status: 500 });
  }
}