

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = String(body?.sourceId ?? "").trim();
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  // If the saved Make credential is legacy webhook, Manage Indexed cannot work.
  // Surface a clear error to the UI so it doesn't "do nothing".
  const { data: source } = await supabase
    .from("sources")
    .select("id, tenant_id, type, method")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (String(source.type) !== "make") return NextResponse.json({ ok: false, code: "MAKE_SOURCE_REQUIRED" }, { status: 400 });

  if (String(source.method) === "webhook") {
    return NextResponse.json(
      {
        ok: false,
        code: "MAKE_LEGACY_WEBHOOK_CONNECTION",
        message:
          "This Make connection was created in legacy webhook mode. Manage Indexed requires a Make API token + region. Please Edit Make credentials and reconnect using API.",
      },
      { status: 400 },
    );
  }

  const origin = new URL(req.url).origin;

  const listRes = await fetch(`${origin}/api/connections/inventory/make/list?sourceId=${encodeURIComponent(sourceId)}`, {
    method: "GET",
    headers: { cookie: req.headers.get("cookie") ?? "" } as any,
  });
  const listText = await listRes.text().catch(() => "");
  let listJson: any = null;
  try { listJson = listText ? JSON.parse(listText) : null; } catch { listJson = null; }

  if (!listRes.ok || !listJson?.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: listJson?.code || "MAKE_LIST_FAILED",
        message: listJson?.message || "Failed to load Make scenarios inventory.",
        details: { upstreamStatus: listRes.status, upstreamBodySnippet: listText.slice(0, 300) },
      },
      { status: 400 },
    );
  }

  const inventory = Array.isArray(listJson?.inventoryEntities) ? listJson.inventoryEntities : [];
  const now = new Date().toISOString();

  // Deduplicate by externalId to avoid upsert conflict edge cases
  const byExternalId = new Map<string, any>();
  for (const e of inventory) {
    const externalId = String(e?.externalId ?? "").trim();
    if (!externalId) continue;
    if (!byExternalId.has(externalId)) byExternalId.set(externalId, e);
  }

  const rows = Array.from(byExternalId.values()).map((e: any) => ({
    tenant_id: membership.tenant_id,
    source_id: sourceId,
    entity_kind: String(e.entityKind || "scenario"),
    external_id: String(e.externalId),
    display_name: String(e.displayName || ""),
    enabled_for_analytics: false,
    enabled_for_actions: false,
    last_seen_at: null,
    created_at: now,
    updated_at: now,
  }));

  const { error: upErr } = await supabase.from("source_entities").upsert(rows, { onConflict: "source_id,external_id" });
  if (upErr) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, importedCount: rows.length });
}


