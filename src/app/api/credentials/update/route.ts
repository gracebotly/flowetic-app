import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";
type Method = "api" | "webhook" | "mcp";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = (body.sourceId as string | undefined) ?? "";
  const platformType = body.platformType as PlatformType | undefined;
  const method = (body.method as Method | undefined) ?? "api";

  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });
  if (!platformType) return NextResponse.json({ ok: false, code: "MISSING_PLATFORM_TYPE" }, { status: 400 });

  // Ensure source belongs to tenant
  const { data: source } = await supabase
    .from("sources")
    .select("id,tenant_id,type")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });

  let secretJson: any = { method, platformType };

  if (method === "api") {
    const apiKey = (body.apiKey as string | undefined) ?? "";
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;
    if (!apiKey) return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });

    const authMode =
      platformType === "n8n"
        ? ((body.n8nAuthMode as "header" | "bearer" | undefined) ?? "bearer")
        : undefined;

    secretJson = { ...secretJson, apiKey, instanceUrl, ...(authMode ? { authMode } : {}) };
  }

  if (method === "mcp") {
    const mcpUrl = (body.mcpUrl as string | undefined) ?? "";
    const authHeader = (body.authHeader as string | undefined) ?? "";
    if (!mcpUrl) return NextResponse.json({ ok: false, code: "MISSING_MCP_URL" }, { status: 400 });

    secretJson = { ...secretJson, mcpUrl, authHeader: authHeader || null };
  }

  if (method === "webhook") {
    const instanceUrl = (body.instanceUrl as string | undefined) ?? null;
    secretJson = { ...secretJson, instanceUrl };
  }

  const secret_hash = encryptSecret(JSON.stringify(secretJson));

  const { error } = await supabase
    .from("sources")
    .update({ secret_hash, method })
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id);

  if (error) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
