import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type EntityKind = "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";

type IndexedEntity = {
  id: string; // `${source_id}:${external_id}`
  entityUuid: string; // Real source_entities.id primary key
  name: string;
  platform: string;
  kind: EntityKind;
  externalId: string;
  sourceId: string;
  lastSeenAt: string | null;
  createdAt: string;
  createdAtTs: number;
  lastUpdatedTs: number;
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'no-data' | 'aggregate-only';
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
    .select("id,source_id,entity_kind,external_id,display_name,last_seen_at,aggregate_stats")
    .in("source_id", sourceIds)
    .eq("tenant_id", membership.tenant_id)
    .eq("enabled_for_analytics", true);

  if (eErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: eErr.message }, { status: 500 });

  const sourceById = new Map<string, { type: string; created_at: string }>();
  for (const s of sources ?? []) {
    sourceById.set(String(s.id), { type: String(s.type), created_at: String(s.created_at) });
  }

  // ── Auto-derive last_seen_at from events for entities missing it ──
  // Build a map of source_id:external_id → latest event timestamp
  const entitiesMissingLastSeen = (entities ?? []).filter((e: any) => !e.last_seen_at);
  const lastSeenFromEvents = new Map<string, string>();

  if (entitiesMissingLastSeen.length > 0) {
    try {
      // For each source, get the latest event timestamps grouped by workflow_id label
      for (const sid of sourceIds) {
        const { data: latestEvents } = await supabase
          .from("events")
          .select("labels, timestamp")
          .eq("tenant_id", membership.tenant_id)
          .eq("source_id", sid)
          .order("timestamp", { ascending: false })
          .limit(200);

        if (latestEvents) {
          for (const ev of latestEvents) {
            const wfId = (ev.labels as any)?.workflow_id;
            const key = `${sid}:${wfId}`;
            if (wfId && !lastSeenFromEvents.has(key)) {
              lastSeenFromEvents.set(key, String(ev.timestamp));
            }
          }
        }
      }
    } catch {
      // Non-fatal — just use stored values
    }
  }

  const rows: IndexedEntity[] = (entities ?? []).map((e: any) => {
    const sourceId = String(e.source_id);
    const meta = sourceById.get(sourceId);

    const createdAt = meta?.created_at ?? new Date().toISOString();
    const createdAtTs = Date.parse(createdAt);

    // Try stored last_seen_at first, then derive from events table
    let lastSeenAt = e.last_seen_at ? String(e.last_seen_at) : null;
    if (!lastSeenAt) {
      const derivedKey = `${sourceId}:${String(e.external_id)}`;
      const derived = lastSeenFromEvents.get(derivedKey);
      if (derived) lastSeenAt = derived;
    }

    const lastSeenTs = lastSeenAt ? Date.parse(lastSeenAt) : NaN;

    const lastUpdatedTs = Number.isFinite(lastSeenTs)
      ? lastSeenTs
      : Number.isFinite(createdAtTs)
      ? createdAtTs
      : Date.now();

    // Derive health status from aggregate_stats
    // Voice (Vapi/Retell): total_calls + success_rate
    // Workflow (n8n): total_executions + success_rate
    // Make: total_operations (always present), total_executions/total_errors (when available)
    let healthStatus: 'healthy' | 'degraded' | 'critical' | 'no-data' | 'aggregate-only' = 'no-data';
    const stats = e.aggregate_stats as Record<string, unknown> | null;
    if (stats) {
      const totalCalls = Number(stats.total_calls ?? stats.total_executions ?? 0);
      const totalOps = Number(stats.total_operations ?? 0);
      const totalErrors = Number(stats.total_errors ?? 0);
      const successRate = Number(stats.success_rate ?? 0);
      const isInstant = Boolean(stats.is_instant_trigger);

      if (totalCalls > 0 && successRate > 0) {
        healthStatus = successRate < 70 ? 'degraded' : 'healthy';
      } else if (totalCalls > 0 && stats.success_rate !== undefined && successRate === 0) {
        healthStatus = 'critical';
      } else if (totalCalls > 0) {
        // success_rate not reported — derive from errors
        const derived = Math.round(((totalCalls - totalErrors) / totalCalls) * 100);
        healthStatus = derived === 0 ? 'critical' : derived < 70 ? 'degraded' : 'healthy';
      } else if (totalOps > 0 && isInstant) {
        // Make instant trigger: has operations but no per-execution logs
        // Portal will show aggregate KPIs, not execution rows
        healthStatus = 'aggregate-only';
      } else if (totalOps > 0) {
        healthStatus = 'healthy';
      }
    }

    return {
      id: `${sourceId}:${String(e.external_id)}`,
      entityUuid: String(e.id),
      name: String(e.display_name ?? ""),
      platform: String(meta?.type ?? "other"),
      kind: String(e.entity_kind ?? "workflow") as EntityKind,
      externalId: String(e.external_id ?? ""),
      sourceId,
      lastSeenAt,
      createdAt,
      createdAtTs: Number.isFinite(createdAtTs) ? createdAtTs : Date.now(),
      lastUpdatedTs,
      healthStatus,
    };
  });

  return NextResponse.json({ ok: true, entities: rows });
}
