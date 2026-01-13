import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

type PlatformType = "n8n" | "make" | "activepieces" | "vapi" | "retell";
type Method = "api" | "webhook";

function jsonResponse(
  status: number,
  payload: Record<string, any>,
) {
  return NextResponse.json(payload, { status });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonResponse(401, { ok: false, code: "AUTH_REQUIRED" });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return jsonResponse(403, { ok: false, code: "TENANT_ACCESS_DENIED" });

  const body = (await req.json().catch(() => ({}))) as any;

  const sourceId = String(body?.sourceId ?? "").trim();
  const platformType = body?.platformType as PlatformType | undefined;
  const method = (body?.method as Method | undefined) ?? "api";

  if (!sourceId) return jsonResponse(400, { ok: false, code: "MISSING_SOURCE_ID" });
  if (!platformType) return jsonResponse(400, { ok: false, code: "MISSING_PLATFORM_TYPE" });

  const { data: source, error: sourceErr } = await supabase
    .from("sources")
    .select("id, tenant_id, type, method, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sourceErr) {
    return jsonResponse(400, { ok: false, code: "SOURCE_LOOKUP_FAILED", message: sourceErr.message });
  }
  if (!source) return jsonResponse(404, { ok: false, code: "SOURCE_NOT_FOUND" });

  // Use existing secret if present to support "edit without re-entering key"
  let existingSecret: any = null;
  if (source.secret_hash) {
    try {
      existingSecret = JSON.parse(decryptSecret(String(source.secret_hash)));
    } catch {
      existingSecret = null;
    }
  }

  // Merge strategy:
  // - Always set method/platformType
  // - Only overwrite secret fields when provided; otherwise preserve existing values
  let secretJson: any = {
    ...(existingSecret && typeof existingSecret === "object" ? existingSecret : {}),
    method,
    platformType,
  };

  if (method === "api") {
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";
    const instanceUrlRaw = typeof body?.instanceUrl === "string" ? body.instanceUrl : undefined;
    const instanceUrl = instanceUrlRaw === undefined ? undefined : (instanceUrlRaw || null);

    // Only update apiKey if provided
    if (apiKey && apiKey.trim()) {
      secretJson.apiKey = apiKey.trim();
    }

    // Only update instanceUrl if provided in payload
    if (instanceUrlRaw !== undefined) {
      secretJson.instanceUrl = instanceUrl;
    }

    const authMode =
      platformType === "n8n"
        ? ((body?.n8nAuthMode as "header" | "bearer" | undefined) ?? (secretJson?.authMode ?? "bearer"))
        : undefined;

    if (authMode) {
      secretJson.authMode = authMode;
    }

    // If apiKey is still missing after merge, block update (this is Option A compliant:
    // user can save non-secret changes IF apiKey is already stored; otherwise fail.)
    if (!String(secretJson?.apiKey ?? "").trim()) {
      return jsonResponse(400, { ok: false, code: "MISSING_API_KEY", message: "API key is required." });
    }
  }


  if (method === "webhook") {
    // Allow update without forcing instanceUrl if it exists already
    const instanceUrlRaw = typeof body?.instanceUrl === "string" ? body.instanceUrl : undefined;
    if (instanceUrlRaw !== undefined) {
      secretJson.instanceUrl = instanceUrlRaw || null;
    }
  }

  // Validate n8n api credentials on update (only if we have enough fields)
  if (platformType === "n8n" && method === "api") {
    const baseUrl = (() => {
      try {
        if (secretJson.instanceUrl) return new URL(secretJson.instanceUrl).origin;
        return null;
      } catch {
        return null;
      }
    })();

    if (!baseUrl) {
      return jsonResponse(400, { ok: false, code: "MISSING_INSTANCE_URL", message: "n8n instance URL is required." });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if ((secretJson.authMode ?? "bearer") === "header") headers["X-N8N-API-KEY"] = String(secretJson.apiKey || "");
    else headers["Authorization"] = `Bearer ${String(secretJson.apiKey || "")}`;

    const testRes = await fetch(`${baseUrl}/api/v1/workflows`, { method: "GET", headers });
    if (!testRes.ok) {
      const t = await testRes.text().catch(() => "");
      return jsonResponse(400, {
        ok: false,
        code: "N8N_API_FAILED",
        message: `n8n API auth failed (${testRes.status}). ${t}`.trim(),
      });
    }
  }

  const secret_hash = encryptSecret(JSON.stringify(secretJson));
  const { error: persistErr } = await supabase
    .from("sources")
    .update({ secret_hash, method })
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id);

  if (persistErr) {
    return jsonResponse(400, { ok: false, code: "PERSISTENCE_FAILED", message: persistErr.message });
  }

  return NextResponse.json({ ok: true });
}
