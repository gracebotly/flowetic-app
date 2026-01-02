
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/secrets";
import { validateMcpServer } from "@/lib/mcp/validateMcpServer";

export const runtime = "nodejs";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as any;

  const platformType = body.platformType as PlatformType | undefined;
  const connectionName = (body.name as string | undefined) ?? "";
  const method = (body.method as "api" | "webhook" | "mcp" | undefined) ?? "api";

  if (!platformType) {
    return NextResponse.json({ ok: false, code: "MISSING_PLATFORM_TYPE" }, { status: 400 });
  }

  // Credentials payload to encrypt into sources.secret_hash
  // NOTE: we store a JSON string inside the encrypted envelope.
  let secretJson: any = { method, platformType };

  if (method === "api") {
    const apiKey = (body.apiKey as string | undefined) ?? "";
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;
    if (!apiKey) {
      return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });
    }
    secretJson = { ...secretJson, apiKey, instanceUrl };
  }

  if (method === "webhook") {
    // webhook-only means user will configure sending events to GetFlowetic later
    // Still store instanceUrl if provided for self-hosted platforms (n8n/activepieces)
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;
    secretJson = { ...secretJson, instanceUrl };
  }

  if (method === "mcp") {
    const mcpUrl = (body.mcpUrl as string | undefined) ?? "";
    const authHeader = (body.authHeader as string | undefined) ?? "";
    if (!mcpUrl) {
      return NextResponse.json({ ok: false, code: "MISSING_MCP_URL" }, { status: 400 });
    }

    const validation = await validateMcpServer({
      serverId: `${platformType}-mcp`,
      url: mcpUrl,
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, code: "MCP_VALIDATION_FAILED", message: validation.error },
        { status: 400 },
      );
    }

    secretJson = {
      ...secretJson,
      mcpUrl,
      authHeader: authHeader || null,
      toolCount: validation.toolCount ?? 0,
    };
  }

  const secret_hash = encryptSecret(JSON.stringify(secretJson));

  const { data: source, error } = await supabase
    .from("sources")
    .insert({
      tenant_id: membership.tenant_id,
      type: platformType,
      name: connectionName || platformType.toUpperCase(),
      secret_hash,
      status: "active",
    })
    .select("id,type,name,status")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, source });
}
