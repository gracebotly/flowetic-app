import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type EntityKind = "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";

type IndexedEntity = {
  id: string; // `${source_id}:${external_id}`
  name: string;
  platform: string;
  kind: EntityKind;
  externalId: string;
  sourceId: string;
  lastSeenAt: string | null;
  createdAt: string;
  createdAtTs: number;
  lastUpdatedTs: number;
};

export async function GET() {
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

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

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
    .in("source_id", sourceIds)
    .eq("tenant_id", membership.tenant_id)
    .eq("enabled_for_analytics", true);

  if (eErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: eErr.message }, { status: 500 });

  const sourceById = new Map<string, { type: string; created_at: string }>();
  for (const s of sources ?? []) {
    sourceById.set(String(s.id), { type: String(s.type), created_at: String(s.created_at) });
  }

  const rows: IndexedEntity[] = (entities ?? []).map((e: any) => {
    const sourceId = String(e.source_id);
    const meta = sourceById.get(sourceId);

    const createdAt = meta?.created_at ?? new Date().toISOString();
    const createdAtTs = Date.parse(createdAt);

    const lastSeenAt = e.last_seen_at ? String(e.last_seen_at) : null;
    const lastSeenTs = lastSeenAt ? Date.parse(lastSeenAt) : NaN;

    const lastUpdatedTs = Number.isFinite(lastSeenTs)
      ? lastSeenTs
      : Number.isFinite(createdAtTs)
      ? createdAtTs
      : Date.now();

    return {
      id: `${sourceId}:${String(e.external_id)}`,
      name: String(e.display_name ?? ""),
      platform: String(meta?.type ?? "other"),
      kind: String(e.entity_kind ?? "workflow") as EntityKind,
      externalId: String(e.external_id ?? ""),
      sourceId,
      lastSeenAt,
      createdAt,
      createdAtTs: Number.isFinite(createdAtTs) ? createdAtTs : Date.now(),
      lastUpdatedTs,
    };
  });

  return NextResponse.json({ ok: true, entities: rows });
}


