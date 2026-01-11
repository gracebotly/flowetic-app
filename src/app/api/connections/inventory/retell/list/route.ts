
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

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

  const { data: source, error: sErr } = await supabase
    .from("sources")
    .select("id, tenant_id, type, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: sErr.message }, { status: 500 });
  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (String(source.type) !== "retell") return NextResponse.json({ ok: false, code: "RETELL_SOURCE_REQUIRED" }, { status: 400 });

  const decrypted = source.secret_hash ? decryptSecret(String(source.secret_hash)) : "";
  let secretJson: any = null;
  try { secretJson = decrypted ? JSON.parse(decrypted) : null; } catch { secretJson = null; }

  const apiKey = String(secretJson?.apiKey || "").trim();
  if (!apiKey) return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });

  // Official Retell docs: List Voice Agents endpoint
  const res = await fetch("https://api.retellai.com/list-agents", {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: "RETELL_AGENTS_FETCH_FAILED", message: `Failed to fetch Retell agents (${res.status}).` },
      { status: 400 },
    );
  }

  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }

  const agents = Array.isArray(parsed?.agents) ? parsed.agents : Array.isArray(parsed) ? parsed : [];
  const inventoryEntities = agents
    .map((a: any) => ({
      entityKind: "agent",
      externalId: String(a?.agent_id ?? a?.id ?? ""),
      displayName: String(a?.agent_name ?? a?.name ?? `Agent ${String(a?.agent_id ?? a?.id ?? "")}`),
    }))
    .filter((x: any) => x.externalId);

  return NextResponse.json({ ok: true, inventoryEntities });
}
