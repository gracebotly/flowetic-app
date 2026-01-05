

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
  const entities = (body.entities as any[] | undefined) ?? [];

  if (!sourceId || entities.length === 0) {
    return NextResponse.json({ ok: false, code: "MISSING_FIELDS" }, { status: 400 });
  }

  const { error: disableErr } = await supabase
    .from("source_entities")
    .update({ enabled_for_analytics: false, enabled_for_actions: false })
    .eq("tenant_id", membership.tenant_id)
    .eq("source_id", sourceId);

  if (disableErr) {
    return NextResponse.json(
      { ok: false, code: "PERSISTENCE_FAILED", message: disableErr.message },
      { status: 400 },
    );
  }

  const rows = entities.map((e) => ({
    tenant_id: membership.tenant_id,
    source_id: sourceId,
    entity_kind: e.entityKind,
    external_id: e.externalId,
    display_name: e.displayName,
    enabled_for_analytics: Boolean(e.enabledForAnalytics),
    enabled_for_actions: Boolean(e.enabledForActions),
  }));

  const { error } = await supabase.from("source_entities").upsert(rows, {
    onConflict: "source_id,external_id",
  });

  if (error) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}


