
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type EntityDraft = {
  externalId: string;
  displayName: string;
  entityKind: "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";
  enabledForAnalytics: boolean;
  enabledForActions: boolean;
};

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
  const entities = (body.entities as EntityDraft[] | undefined) ?? [];

  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });
  if (!Array.isArray(entities) || entities.length === 0) {
    return NextResponse.json({ ok: false, code: "MISSING_ENTITIES" }, { status: 400 });
  }

  // Ensure source belongs to tenant
  const { data: source, error: sErr } = await supabase
    .from("sources")
    .select("id,tenant_id")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sErr || !source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });

  const now = new Date().toISOString();

  const rows = entities.map((e) => ({
    tenant_id: membership.tenant_id,
    source_id: sourceId,
    entity_kind: e.entityKind,
    external_id: e.externalId,
    display_name: e.displayName,
    enabled_for_analytics: !!e.enabledForAnalytics,
    enabled_for_actions: !!e.enabledForActions,
    last_seen_at: null,
    created_at: now,
    updated_at: now,
  }));

  const { error: upErr } = await supabase.from("source_entities").upsert(rows, {
    onConflict: "source_id,external_id",
  });

  if (upErr) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, savedCount: rows.length });
}

