import { NextRequest } from "next/server";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { mastra } from "@/mastra";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tenantId = body.tenantId as string | undefined;
    const userId = body.userId as string | undefined;
    const userRole = body.userRole as "admin" | "client" | "viewer" | undefined;
    const interfaceId = body.interfaceId as string | undefined;
    const threadId = body.threadId as string | undefined;
    const platformType = body.platformType as
      | "vapi"
      | "retell"
      | "n8n"
      | "mastra"
      | "crewai"
      | "pydantic_ai"
      | "other"
      | undefined;
    const sourceId = body.sourceId as string | undefined;
    const lastMessage = (body.lastMessage as string | undefined) ?? "";

    if (!tenantId || !userId || !userRole || !interfaceId || !threadId || !platformType || !sourceId) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "MISSING_REQUIRED_FIELDS",
          message:
            "Missing required fields: tenantId, userId, userRole, interfaceId, threadId, platformType, sourceId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const runtimeContext = new RuntimeContext();
    runtimeContext.set("tenantId", tenantId);
    runtimeContext.set("userId", userId);
    runtimeContext.set("userRole", userRole);
    runtimeContext.set("interfaceId", interfaceId);
    runtimeContext.set("threadId", threadId);
    runtimeContext.set("platformType", platformType);
    runtimeContext.set("sourceId", sourceId);

    const agent = mastra.getAgent("platformMappingMaster");
    if (!agent) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AGENT_NOT_FOUND",
          message: "platformMappingMaster agent not registered",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await agent.generate(lastMessage, { runtimeContext, maxSteps: 8 });

    return new Response(
      JSON.stringify({
        type: "success",
        text: result.text ?? "",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Agent master route error:", err);
    return new Response(
      JSON.stringify({
        type: "error",
        code: "UNKNOWN_ERROR",
        message: err?.message ?? "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
