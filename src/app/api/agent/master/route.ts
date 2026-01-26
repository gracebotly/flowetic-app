import { NextRequest, NextResponse } from "next/server";
// import { RequestContext } from "@mastra/core/request-context"; // Removed - invalid import
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

    const action = String(body?.action || "message");

    // Message can come from either shape
    const message =
      (body.message as string | undefined) ??
      (body.lastMessage as string | undefined) ??
      (body.messages?.[body.messages.length - 1]?.content as string | undefined) ??
      "";

    // Handle initialize action
    if (action === "initialize") {
      const ctx = body?.context || {};
      const displayName = String(ctx?.displayName || "");
      const platformType = String(ctx?.platformType || "");

      return NextResponse.json({
        type: "success",
        message: displayName
          ? `I see you selected "${displayName}" on ${platformType}. What would you like to build—an analytics dashboard, a tool, or a form?`
          : `What would you like to build—an analytics dashboard, a tool, or a form?`,
      });
    }

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

    // 4) Build runtimeContext with real IDs (plain object instead of RequestContext)
    const runtimeContext = {
      tenantId,
      userId,
      userRole,
      sourceId,
      platformType,
      threadId,
      get: (key: string) => {
        const obj: any = { tenantId, userId, userRole, sourceId, platformType, threadId };
        return obj[key];
      }
    } as any;

    // 5) Always start with Master Router
    const master = mastra.getAgent("vibeRouterAgent");
    if (!master) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AGENT_NOT_FOUND",
          message: "masterRouterAgent not registered.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const { wantsPreview, wantsMapping } = detectIntent(message);

    // NO_ROADMAP_RULES: Guard against.agent explaining the process
    if (message.toLowerCase().includes("phase") || 
        message.toLowerCase().includes("step") || 
        message.toLowerCase().includes("roadmap") ||
        message.toLowerCase().includes("process")) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "NO_ROADMAP_RULES",
          message: "Let's focus on what you want to build right now, not the process. Which outcome matters most to you?",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ENFORCE STYLE_BEFORE_PREVIEW
    if (wantsPreview || wantsMapping) {
      const { data: threads } = await supabase
        .from("assistant_threads")
        .select("messages")
        .eq("tenant_id", tenantId)
        .eq("thread_id", threadId)
        .maybeSingle();

      const messages = threads?.messages || [];
      const hasSelectedStyle = messages.some((msg: any) => 
        msg.content?.includes("selected_style") || 
        msg.tool_call?.includes("select_style_bundle") ||
        msg.role === "assistant" && msg.content?.toLowerCase().includes("style")
      );

      if (!hasSelectedStyle) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "STYLE_REQUIRED_FIRST",
            message: "Hey! We need to pick a style before generating a preview. Choose one of the style pack options on the right.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

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
        requestContext: runtimeContext,
      });

      const mappingResponse = await mappingAgent.generate(message, {
        maxSteps: 8,
        requestContext: runtimeContext,
      });

      return new Response(
        JSON.stringify({
          type: "success",
          agentKey: "masterRouterAgent->platformMappingMaster",
          text: `${routerResponse.text ?? ""}\n\n${mappingResponse.text ?? ""}`.trim(),
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const routerOnly = await master.generate(message, {
      maxSteps: 3,
      requestContext: runtimeContext,
    });

    return new Response(
      JSON.stringify({
        type: "success",
        agentKey: "masterRouterAgent",
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
