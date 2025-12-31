import { NextRequest } from "next/server";
import { CopilotRuntime, ExperimentalEmptyAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { mastra } from "@/mastra";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  const supabase = await createClient();

  // Auth/session → tenant context
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return new Response(
      JSON.stringify({
        type: "error",
        code: "AUTH_REQUIRED",
        message: "You must be signed in to use the assistant.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipErr || !membership?.tenant_id) {
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
  const userRole = (membership.role as "admin" | "client" | "viewer" | null) ?? "admin";

  // Pick a default source/platform from DB (MVP). Never ask user for UUIDs.
  const { data: source, error: sourceErr } = await supabase
    .from("sources")
    .select("id, type, status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Allow agent to still answer "what can you do?" even if not connected.
  const sourceId = source?.id ?? null;
  const platformType = (source?.type ?? "other") as
    | "vapi"
    | "retell"
    | "n8n"
    | "mastra"
    | "crewai"
    | "pydantic_ai"
    | "other";

  // Load local Mastra agents
  const mastraAgents = MastraAgent.getLocalAgents({ mastra });

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
    // IMPORTANT: inject context into every request so tools can use it
    onRequest: async ({ request, headers }) => {
      return {
        request,
        headers: {
          ...headers,
          "x-gf-tenant-id": tenantId,
          "x-gf-user-id": user.id,
          "x-gf-user-role": userRole,
          ...(sourceId ? { "x-gf-source-id": sourceId } : {}),
          "x-gf-platform-type": platformType,
        },
      };
    },
  });

  // If there is no connected source, still allow chat, but tools will gate.
  // The agent should guide user to Sources instead of asking for UUIDs.
  if (sourceErr) {
    console.error("[copilotkit] failed to fetch sources", sourceErr);
  }

  return handleRequest(req);
};
