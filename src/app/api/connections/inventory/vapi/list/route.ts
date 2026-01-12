
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

type VapiAssistant = {
  id: string;
  name?: string | null;
};

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sourceId = String(searchParams.get("sourceId") || "").trim();
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  // Verify source belongs to tenant
  const { data: source, error: sErr } = await supabase
    .from("sources")
    .select("id, tenant_id, type, secret_hash, method")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: sErr.message }, { status: 500 });
  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (String(source.type) !== "vapi") return NextResponse.json({ ok: false, code: "VAPI_SOURCE_REQUIRED" }, { status: 400 });

  const decrypted = source.secret_hash ? decryptSecret(String(source.secret_hash)) : "";
  let secretJson: any = null;
  try {
    secretJson = decrypted ? JSON.parse(decrypted) : null;
  } catch {
    secretJson = null;
  }

  const apiKey = String(secretJson?.apiKey || "").trim();
  if (!apiKey) return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });

  const endpoints = [
    "https://api.vapi.ai/v1/assistants",
    "https://api.vapi.ai/assistants",
    "https://api.vapi.ai/api/v1/assistants",
    "https://api.vapi.ai/api/assistants",
  ];

  let lastStatus: number | null = null;
  let lastBody = "";
  let okText: string | null = null;

  for (const url of endpoints) {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text().catch(() => "");
    lastStatus = res.status;
    lastBody = text;

    if (res.ok) {
      okText = text;
      break;
    }

    if (res.status !== 404) break;
  }

  if (!okText) {
    return NextResponse.json(
      {
        ok: false,
        code: "VAPI_ASSISTANTS_FETCH_FAILED",
        message: `Failed to fetch Vapi assistants (${lastStatus ?? 400}).`,
        details: { providerStatus: lastStatus ?? undefined, providerBodySnippet: lastBody.slice(0, 300) },
      },
      { status: 400 },
    );
  }

  const text = okText;

  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  const assistants: VapiAssistant[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.assistants)
      ? parsed.assistants
      : [];

  const inventoryEntities = assistants.map((a) => ({
    entityKind: "assistant",
    externalId: String(a.id),
    displayName: String(a.name || `Assistant ${a.id}`),
  }));

  return NextResponse.json({
    ok: true,
    inventoryEntities,
  });
}
