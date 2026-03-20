import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type EntityKind = "workflow" | "scenario" | "flow" | "agent" | "assistant" | "squad";

type IndexedEntity = {
  id: string;
  entityUuid: string;
  name: string;
  platform: string;
  kind: EntityKind;
  externalId: string;
  sourceId: string;
  lastSeenAt: string | null;
  createdAt: string;
  createdAtTs: number;
  lastUpdatedTs: number;
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'no-data';
  hasEvents: boolean;
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

  // ── Derive last_seen_at AND event existence from events table ──
  // Always runs: hasEvents is returned to the frontend for every entity
  // to show "Limited detail" only on instant/webhook scenarios with no execution logs.
  const lastSeenFromEvents = new Map<string, string>();
  const entityHasEvents = new Map<string, boolean>();

  {
    try {
      for (const sid of sourceIds) {
        const { data: latestEvents } = await supabase
          .from("events")
          .select("state, labels, timestamp")
          .eq("tenant_id", membership.tenant_id)
          .eq("source_id", sid)
          .order("timestamp", { ascending: false })
          .limit(200);

        if (latestEvents) {
          for (const ev of latestEvents) {
            // Primary: state.workflow_id (canonical for all platforms)
            const state = ev.state as Record<string, unknown> | null;
            const stateWfId = state ? String(state.workflow_id ?? state.assistant_id ?? state.agent_id ?? "") : "";
            // Fallback: labels.workflow_id
            const labels = ev.labels as Record<string, string> | null;
            const labelWfId = labels?.workflow_id ?? labels?.assistant_id ?? labels?.agent_id ?? "";

            const entityExtId = stateWfId || labelWfId;
            if (!entityExtId || entityExtId === "undefined" || entityExtId === "null") continue;

            const key = `${sid}:${entityExtId}`;

            // Track last seen
            if (!lastSeenFromEvents.has(key)) {
              lastSeenFromEvents.set(key, String(ev.timestamp));
            }

            // Track existence
            entityHasEvents.set(key, true);
          }
        }
      }
    } catch {
      // Non-fatal — just use stored values
    }
  }

  const rows: IndexedEntity[] = (entities ?? []).map((e: {
    id: string;
    source_id: string;
    entity_kind: string | null;
    external_id: string | null;
    display_name: string | null;
    last_seen_at: string | null;
    aggregate_stats: Record<string, unknown> | null;
  }) => {
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

    let healthStatus: 'healthy' | 'degraded' | 'critical' | 'no-data' = 'no-data';
    const stats = e.aggregate_stats as Record<string, unknown> | null;
    if (stats) {
      const totalCalls = Number(stats.total_calls ?? stats.total_executions ?? 0);
      const totalOps = Number(stats.total_operations ?? 0);
      const totalErrors = Number(stats.total_errors ?? 0);
      const successRate = Number(stats.success_rate ?? 0);

      if (totalCalls > 0) {
        if (successRate > 0) {
          healthStatus = successRate < 70 ? 'degraded' : 'healthy';
        } else if (stats.success_rate !== undefined && successRate === 0) {
          healthStatus = 'critical';
        } else {
          const derived = totalCalls > 0
            ? Math.round(((totalCalls - totalErrors) / totalCalls) * 100)
            : 0;
          healthStatus = derived === 0 ? 'critical' : derived < 70 ? 'degraded' : 'healthy';
        }
      } else if (totalOps > 0) {
        // Make: has operations = it ran
        if (totalErrors > 0) {
          const base = totalCalls > 0 ? totalCalls : totalOps;
          const derived = Math.round(((base - totalErrors) / base) * 100);
          healthStatus = derived === 0 ? 'critical' : derived < 70 ? 'degraded' : 'healthy';
        } else {
          healthStatus = 'healthy';
        }
      }
    }

    // Fallback: n8n and Vapi don't write aggregate_stats, but they do write events.
    // If aggregate_stats is null but the entity has events → healthy.
    if (healthStatus === 'no-data' && !stats) {
      const eventKey = `${sourceId}:${String(e.external_id)}`;
      if (entityHasEvents.get(eventKey)) {
        healthStatus = 'healthy';
      }
    }

    const eventKey = `${sourceId}:${String(e.external_id)}`;

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
      hasEvents: entityHasEvents.get(eventKey) === true,
    };
  });

  return NextResponse.json({ ok: true, entities: rows });
}
