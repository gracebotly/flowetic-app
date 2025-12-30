import { mastra } from "@/mastra";
import { NextRequest } from "next/server";
import { RuntimeContext } from "@mastra/core/runtime-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function detectIntent(message: string) {
  const m = message.toLowerCase();
  const wantsPreview =
    m.includes("preview") ||
    m.includes("generate") ||
    m.includes("create dashboard") ||
    m.includes("build dashboard") ||
    m.includes("generate dashboard");

  const wantsMapping =
    m.includes("mapping") ||
    m.includes("map ") ||
    m.includes("template") ||
    m.includes("recommend template");

  return { wantsPreview, wantsMapping };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tenantId = body.tenantId as string | undefined;
    const userId = body.userId as string | undefined;
    const sourceId = body.sourceId as string | undefined;
    const platformType = body.platformType as string | undefined;

    // Support both shapes:
    // 1) body.message (string)
    // 2) body.messages (array) used by some UIs
    const message =
      (body.message as string | undefined) ??
      (body.messages?.[body.messages.length - 1]?.content as string | undefined) ??
      "";

    if (!tenantId || !userId) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "MISSING_REQUIRED_FIELDS",
          message: "tenantId and userId are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const runtimeContext = new RuntimeContext();
    runtimeContext.set("tenantId", tenantId);
    runtimeContext.set("userId", userId);
    if (sourceId) runtimeContext.set("sourceId", sourceId);
    if (platformType) runtimeContext.set("platformType", platformType);

    // Always start with Master Router (single user-facing entrypoint)
    const master = mastra.getAgent("masterRouter");
    if (!master) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AGENT_NOT_FOUND",
          message: "masterRouter agent not registered in mastra/index.ts",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const { wantsPreview, wantsMapping } = detectIntent(message);

    // If the user wants mapping/template/preview, delegate to platformMapping agent
    if (wantsPreview || wantsMapping) {
      const mappingAgent = mastra.getAgent("platformMapping");
      if (!mappingAgent) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "AGENT_NOT_FOUND",
            message: "platformMapping agent not registered in mastra/index.ts",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      // 1) Master Router: short acknowledgement (keeps your architecture contract)
      const routerResponse = await master.generate(message, {
        maxSteps: 3,
        runtimeContext,
      });

      // 2) Platform Mapping Agent: do the actual work (tools/mapping/template)
      const mappingResponse = await mappingAgent.generate(message, {
        maxSteps: 8,
        runtimeContext,
      });

      // Return combined text in a predictable way
      return new Response(
        JSON.stringify({
          type: "success",
          agentKey: "masterRouter->platformMapping",
          text: `${routerResponse.text}\n\n${mappingResponse.text}`,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Otherwise just use Master Router
    const routerOnly = await master.generate(message, { maxSteps: 3, runtimeContext });

    return new Response(
      JSON.stringify({
        type: "success",
        agentKey: "masterRouter",
        text: routerOnly.text ?? "",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Master route error:", error);
    return new Response(
      JSON.stringify({
        type: "error",
        code: "UNKNOWN_ERROR",
        message: error?.message || "An unexpected error occurred.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
