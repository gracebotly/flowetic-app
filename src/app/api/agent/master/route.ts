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

    // Accept either { message } or { messages: [...] }
    const message =
      (body.message as string | undefined) ??
      (body.lastMessage as string | undefined) ??
      (body.messages?.[body.messages.length - 1]?.content as string | undefined) ??
      "";

    // 1) Auth: derive userId from session
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

    // 2) Tenancy: derive tenantId + role from memberships
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
          message: "You do not have access to a tenant workspace.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const tenantId = membership.tenant_id as string;
    const userRole = (membership.role ?? "admin") as "admin" | "client" | "viewer";

    // 3) Resolve a connected source (sourceId + platformType)
    // Allow explicit values only if provided (no placeholders)
    let sourceId = typeof body.sourceId === "string" && body.sourceId.trim() ? body.sourceId : undefined;
    let platformType =
      typeof body.platformType === "string" && body.platformType.trim() ? body.platformType : undefined;

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
            message:
              "No platform is connected yet. Go to Sources and connect your platform so I can generate a dashboard preview.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      sourceId = source.id;
      platformType = platformType ?? source.type ?? "other";
    }

    if (!platformType) platformType = "other";

    // 4) Thread context: accept threadId if present, else create stable fallback
    const threadId =
      (typeof body.threadId === "string" && body.threadId.trim()) || `thread-${tenantId}`;

    // 5) RuntimeContext (partial but real; no placeholders)
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("tenantId", tenantId);
    runtimeContext.set("userId", userId);
    runtimeContext.set("userRole", userRole);
    runtimeContext.set("threadId", threadId);
    runtimeContext.set("sourceId", sourceId);
    runtimeContext.set("platformType", platformType);

    // 6) Agents
    const masterRouter = mastra.getAgent("masterRouter");
    if (!masterRouter) {
      return new Response(
        JSON.stringify({
          type: "error",
          code: "AGENT_NOT_FOUND",
          message: "masterRouter agent is not registered.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const { wantsPreview, wantsMapping } = detectIntent(message);

    // Always let router speak first (Agent 1 voice), but keep it short
    const routerResponse = await masterRouter.generate(message, {
      maxSteps: 3,
      runtimeContext,
    });

    if (wantsPreview || wantsMapping) {
      const platformMapping = mastra.getAgent("platformMapping");
      if (!platformMapping) {
        return new Response(
          JSON.stringify({
            type: "error",
            code: "AGENT_NOT_FOUND",
            message: "platformMapping agent is not registered.",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      const mappingResponse = await platformMapping.generate(message, {
        maxSteps: 8,
        runtimeContext,
      });

      return new Response(
        JSON.stringify({
          type: "success",
          agentKey: "masterRouter->platformMapping",
          text: `${routerResponse.text ?? ""}\n\n${mappingResponse.text ?? ""}`.trim(),
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        type: "success",
        agentKey: "masterRouter",
        text: routerResponse.text ?? "",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[/api/agent/master] error", error);
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
