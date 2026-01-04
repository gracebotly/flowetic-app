import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type EntityType = "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";

type IndexedEntity = {
  id: string; // source_entities row identity = `${source_id}:${external_id}`
  name: string; // display_name
  platform: string; // sources.type
  type: EntityType; // entity_kind
  last_seen_at: string; // ISO or null->"—" handled client-side
  created_at: string; // source created_at (until you add entity created_at)
  created_at_ts: number;
  last_updated_ts: number; // derived from last_seen_at when available, else created_at
};

export async function GET() {
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

  const { data: sources, error: sErr } = await supabase
    .from("sources")
    .select("id,type,created_at")
    .eq("tenant_id", membership.tenant_id);

  if (sErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: sErr.message }, { status: 500 });

  const sourceIds = (sources ?? []).map((s) => s.id);
  if (sourceIds.length === 0) return NextResponse.json({ ok: true, entities: [] });

  const { data: entities, error: eErr } = await supabase
    .from("source_entities")
    .select("source_id,entity_kind,external_id,display_name,last_seen_at")
    .in("source_id", sourceIds);

  if (eErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: eErr.message }, { status: 500 });

  const sourceById = new Map<string, { type: string; created_at: string }>();
  for (const s of sources ?? []) {
    sourceById.set(s.id, { type: String(s.type), created_at: String(s.created_at) });
  }

  const rows: IndexedEntity[] = (entities ?? []).map((e: any) => {
    const s = sourceById.get(String(e.source_id));
    const createdIso = s?.created_at ?? new Date().toISOString();
    const createdTs = Date.parse(createdIso);
    const lastSeenIso = e.last_seen_at ? String(e.last_seen_at) : "";
    const lastSeenTs = lastSeenIso ? Date.parse(lastSeenIso) : NaN;

    return {
      id: `${String(e.source_id)}:${String(e.external_id)}`,
      name: String(e.display_name ?? ""),
      platform: String(s?.type ?? "other"),
      type: String(e.entity_kind ?? "workflow") as EntityType,
      last_seen_at: lastSeenIso,
      created_at: createdIso,
      created_at_ts: Number.isFinite(createdTs) ? createdTs : Date.now(),
      last_updated_ts: Number.isFinite(lastSeenTs) ? lastSeenTs : (Number.isFinite(createdTs) ? createdTs : Date.now()),
    };
  });

  return NextResponse.json({ ok: true, entities: rows });
}


