import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

/**
 * GET /api/events
 * Authenticated endpoint for fetching normalized events.
 * Used by PortalPreview in wizard and admin views.
 * Documented in GETFLOWETIC_CONTROL_PANEL_V4.md line 774.
 */
export const GET = withApiHandler(async function GET(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const tenantId = membership?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "NO_TENANT" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("source_id");
  const type = searchParams.get("type");
  const workflowName = searchParams.get("workflow_name");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 500);

  // Optional: comma-separated list of agent/workflow external_ids to filter by
  const entityExternalIds = searchParams.get("entity_external_ids");

  if (!sourceId) {
    return NextResponse.json({ error: "source_id is required" }, { status: 400 });
  }

  const { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("id", sourceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  let query = supabase
    .from("events")
    .select("id, type, name, value, unit, text, state, labels, timestamp, platform_event_id, source_id")
    .eq("tenant_id", tenantId)
    .eq("source_id", sourceId)
    .not("type", "eq", "tool_event")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (type) query = query.eq("type", type);
  if (workflowName) {
    query = query.or(
      `state->>workflow_name.eq.${workflowName},state->>workflow_id.eq.${workflowName}`
    );
  }

  const { data: events, error } = await query;

  if (error) {
    console.error("[GET /api/events] Query failed:", error.message);
    return NextResponse.json({ error: "QUERY_FAILED", message: error.message }, { status: 500 });
  }

  let filteredEvents = events ?? [];

  // Entity-level filtering: if entity_external_ids provided, filter in JS
  // (Postgres JSONB OR across multiple values is complex; JS post-filter is simpler)
  if (entityExternalIds) {
    const ids = new Set(entityExternalIds.split(",").map((s) => s.trim()).filter(Boolean));
    if (ids.size > 0) {
      filteredEvents = filteredEvents.filter((e) => {
        const state = (e.state as Record<string, unknown>) ?? {};
        // Check workflow_id first — this is the canonical entity identifier set by all import routes.
        // Then fall back to assistant_id / agent_id for any legacy data.
        const wfId = String(state.workflow_id ?? "");
        const agentId = String(state.assistant_id ?? state.agent_id ?? "");
        // If no entity identifier is stored at all, include the event
        if ((!wfId || wfId === "undefined" || wfId === "null") &&
            (!agentId || agentId === "undefined" || agentId === "null")) return true;
        return ids.has(wfId) || ids.has(agentId);
      });
    }
  }

  return NextResponse.json({ events: filteredEvents, count: filteredEvents.length });
});