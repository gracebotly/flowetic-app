import { NextRequest } from "next/server";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { mastra } from "@/mastra";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function detectIntent(message: string) {
  const m = message.toLowerCase();

  const wantsPreview =
    m.includes("preview") ||
    m.includes("generate preview") ||
    m.includes("generate a preview") ||
    m.includes("create a preview") ||
    m.includes("build a preview") ||
    m.includes("generate dashboard") ||
    m.includes("create dashboard") ||
    m.includes("build dashboard");

  const wantsMapping =
    m.includes("mapping") ||
    m.includes("map ") ||
    m.includes("template") ||
    m.includes("recommend template") ||
    m.includes("best template");

  return { wantsPreview, wantsMapping };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await req.json().catch(() => ({} as any));

    // Message can come from either shape
    const message =
      (body.message as string | undefined) ??
      (body.lastMessage as string | undefined) ??
      (body.messages?.[body.messages.length - 1]?.content as string | undefined) ??
      "";

    // 1) Resolve authenticated userId
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AUTH_REQUIRED",
          message: "Please sign in to continue.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    // 2) Resolve tenantId from memberships
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership?.tenant_id) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "TENANT_ACCESS_DENIED",
          message: "No tenant membership found for this user.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const tenantId = membership.tenant_id as string;
    const userRole = (membership.role ?? "admin") as "admin" | "client" | "viewer";

    // 3) Resolve sourceId + platformType
    // Allow body.sourceId/platformType only if they look like real values; otherwise ignore.
    const bodySourceId = typeof body.sourceId === "string" ? body.sourceId : undefined;
    const bodyPlatformType = typeof body.platformType === "string" ? body.platformType : undefined;

    let sourceId = bodySourceId;
    let platformType = bodyPlatformType;

    if (!sourceId) {
      const { data: source, error: sourceError } = await supabase
        .from("sources")
        .select("id,type,status,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sourceError || !source?.id) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "CONNECTION_NOT_CONFIGURED",
            message: "No platform source is connected yet. Go to Sources and connect a platform first.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      sourceId = source.id;
      platformType = platformType ?? source.type ?? "other";
    }

    if (!platformType) platformType = "other";

    // ThreadId: allow body.threadId if present, else derive a stable fallback
    const threadId =
      (typeof body.threadId === "string" && body.threadId.trim()) ||
      `thread-${tenantId}`;

    // 4) Build runtimeContext with real IDs
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("tenantId", tenantId);
    runtimeContext.set("userId", userId);
    runtimeContext.set("userRole", userRole);
    runtimeContext.set("sourceId", sourceId);
    runtimeContext.set("platformType", platformType);
    runtimeContext.set("threadId", threadId);

    // 5) Always start with Master Router
    const master = mastra.getAgent("masterRouter");
    if (!master) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AGENT_NOT_FOUND",
          message: "masterRouter agent not registered.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const { wantsPreview, wantsMapping } = detectIntent(message);

    if (wantsPreview || wantsMapping) {
      const mappingAgent = mastra.getAgent("platformMappingMaster");
      if (!mappingAgent) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "AGENT_NOT_FOUND",
            message: "platformMappingMaster agent is not registered.",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      const routerResponse = await master.generate(message, {
        maxSteps: 3,
        runtimeContext,
      });

      const mappingResponse = await mappingAgent.generate(message, {
        maxSteps: 8,
        runtimeContext,
      });

      return new Response(
        JSON.stringify({
          type: "success",
          agentKey: "masterRouter->platformMappingMaster",
          text: `${routerResponse.text ?? ""}\n\n${mappingResponse.text ?? ""}`.trim(),
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const routerOnly = await master.generate(message, {
      maxSteps: 3,
      runtimeContext,
    });

    return new Response(
      JSON.stringify({
        type: "success",
        agentKey: "masterRouter",
        text: routerOnly.text ?? "",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[/api/agent/master] error", error);
    const message = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        type: "error",
        code: "UNKNOWN_ERROR",
        message: "Something went wrong. Please try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
