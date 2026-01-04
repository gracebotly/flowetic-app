
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

function normalizeBaseUrl(instanceUrl?: string | null) {
  if (!instanceUrl) return null;
  try {
    const u = new URL(instanceUrl);
    return u.origin;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("sourceId") || "";
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  const { data: source } = await supabase
    .from("sources")
    .select("id,type,secret_hash,tenant_id")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (source.type !== "n8n") return NextResponse.json({ ok: false, code: "INVALID_PLATFORM" }, { status: 400 });
  if (!source.secret_hash) return NextResponse.json({ ok: false, code: "MISSING_SECRET" }, { status: 400 });

  const secret = JSON.parse(decryptSecret(source.secret_hash)) as {
    method: "api" | "webhook" | "mcp";
    apiKey?: string;
    instanceUrl?: string | null;
    authMode?: "header" | "bearer";
  };
  if (secret.method !== "api" || !secret.apiKey) return NextResponse.json({ ok: false, code: "N8N_API_REQUIRED" }, { status: 400 });

  const baseUrl = normalizeBaseUrl(secret.instanceUrl);
  if (!baseUrl) return NextResponse.json({ ok: false, code: "MISSING_INSTANCE_URL" }, { status: 400 });

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if ((secret.authMode ?? "bearer") === "header") {
    headers["X-N8N-API-KEY"] = secret.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${secret.apiKey}`;
  }

  const res = await fetch(`${baseUrl}/api/v1/workflows`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { ok: false, code: "N8N_API_FAILED", message: `n8n API request failed (${res.status}). ${text}`.trim() },
      { status: 400 },
    );
  }

  const workflows = (await res.json().catch(() => [])) as any[];

  return NextResponse.json({
    ok: true,
    workflows: workflows.map((w) => ({
      id: String(w.id),
      name: String(w.name ?? `Workflow ${w.id}`),
      active: Boolean(w.active ?? true),
      // triggerType will be derived later from node graph; for now default "Webhook"
      triggerType: "Webhook" as "Webhook" | "Schedule" | "Chat" | "Form",
      updatedAt: w.updatedAt ?? null,
      createdAt: w.createdAt ?? null,
    })),
  });
}
