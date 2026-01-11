
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

  // Pull inventory from list endpoint (single source of truth)
  const listRes = await fetch(
    `${new URL(req.url).origin}/api/connections/inventory/vapi/list?sourceId=${encodeURIComponent(sourceId)}`,
    { method: "GET", headers: { cookie: req.headers.get("cookie") ?? "" } as any },
  );
  const listJson = await listRes.json().catch(() => ({}));
  if (!listRes.ok || !listJson?.ok) {
    return NextResponse.json(
      { ok: false, code: listJson?.code || "VAPI_LIST_FAILED", message: listJson?.message || "Failed to list assistants." },
      { status: 400 },
    );
  }

  const inventory = Array.isArray(listJson?.inventoryEntities) ? listJson.inventoryEntities : [];
  const now = new Date().toISOString();

  const rows = inventory.map((a: any) => ({
    tenant_id: membership.tenant_id,
    source_id: sourceId,
    entity_kind: String(a.entityKind || "assistant"),
    external_id: String(a.externalId),
    display_name: String(a.displayName || ""),
    enabled_for_analytics: false,
    enabled_for_actions: false,
    last_seen_at: null,
    created_at: now,
    updated_at: now,
  })).filter((r: any) => r.external_id);

  const { error: upErr } = await supabase.from("source_entities").upsert(rows, {
    onConflict: "source_id,external_id",
  });

  if (upErr) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, importedCount: rows.length });
}
