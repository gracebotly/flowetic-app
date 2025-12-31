import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { mastra } from "@/mastra";
import { createClient } from "@/lib/supabase/server";
import { RuntimeContext } from "@mastra/core/runtime-context";

export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  const supabase = await createClient();

  // Get authenticated user
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
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get user's tenant from memberships
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
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const tenantId = membership.tenant_id as string;
  const userRole = (membership.role as "admin" | "client" | "viewer" | null) ?? "admin";

  // Get default source (most recent)
  const { data: source } = await supabase
    .from("sources")
    .select("id, type, status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sourceId = source?.id ?? null;
  const platformType = (source?.type ?? "other") as
    | "vapi"
    | "retell"
    | "n8n"
    | "mastra"
    | "crewai"
    | "pydantic_ai"
    | "other";

  // Create RuntimeContext with auth/tenant data
  const runtimeContext = new RuntimeContext();
  runtimeContext.set("tenantId", tenantId);
  runtimeContext.set("userId", user.id);
  runtimeContext.set("userRole", userRole);
  if (sourceId) {
    runtimeContext.set("sourceId", sourceId);
  }
  runtimeContext.set("platformType", platformType);

  // Get Mastra agents with injected context
  const mastraAgents = MastraAgent.getLocalAgents({
    mastra,
    runtimeContext,
  });

  const copilotRuntime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
