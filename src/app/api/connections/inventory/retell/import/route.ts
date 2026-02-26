import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";
import { workspace } from '@/mastra/workspace';
import { indexWorkflowToWorkspace, clearSourceWorkflows } from '@/mastra/lib/workflowIndexer';
import { generateSkillMd, type WorkflowData } from '@/mastra/lib/skillMdGenerator';

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
  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = String(body?.sourceId ?? "").trim();
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  // Verify source and get credentials
  const { data: source, error: sErr } = await supabase
    .from("sources")
    .select("id, tenant_id, type, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sErr || !source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (String(source.type) !== "retell") return NextResponse.json({ ok: false, code: "RETELL_SOURCE_REQUIRED" }, { status: 400 });

  const decrypted = source.secret_hash ? decryptSecret(String(source.secret_hash)) : "";
  let secretJson: any = null;
  try {
    secretJson = decrypted ? JSON.parse(decrypted) : null;
  } catch {
    secretJson = null;
  }

  const apiKey = String(secretJson?.apiKey || "").trim();
  if (!apiKey) return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });

  const retellHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Fetch agents list
  const agentsRes = await fetch("https://api.retellai.com/list-agents", {
    method: "GET",
    headers: retellHeaders,
  });

  if (!agentsRes.ok) {
    const text = await agentsRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, code: "RETELL_AGENTS_FETCH_FAILED", message: `Failed to fetch Retell agents (${agentsRes.status}).` },
      { status: 400 },
    );
  }

  const agentsRaw = await agentsRes.json().catch(() => []);
  const agents = Array.isArray(agentsRaw) ? agentsRaw : Array.isArray(agentsRaw?.agents) ? agentsRaw.agents : [];

  if (agents.length === 0) {
    return NextResponse.json({
      ok: true,
      importedCount: 0,
      warning: "No Retell agents found.",
    });
  }

  // Clear existing workflows
  try {
    await clearSourceWorkflows(workspace, sourceId);
  } catch (e) {
    console.error('[retell import] Failed to clear workspace workflows:', e);
  }

  const now = new Date().toISOString();
  const byExternalId = new Map<string, any>();

  for (const a of agents) {
    const externalId = String(a?.agent_id ?? a?.id ?? "").trim();
    if (!externalId) continue;
    if (!byExternalId.has(externalId)) byExternalId.set(externalId, a);
  }

  const allExternalIds = Array.from(byExternalId.keys());

  // Fetch existing entities
  const { data: existingEntities } = await supabase
    .from("source_entities")
    .select("external_id, enabled_for_analytics, enabled_for_actions")
    .eq("source_id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .in("external_id", allExternalIds);

  const existingMap = new Map<string, { enabled_for_analytics: boolean; enabled_for_actions: boolean }>();
  for (const e of existingEntities ?? []) {
    existingMap.set(String(e.external_id), {
      enabled_for_analytics: Boolean(e.enabled_for_analytics),
      enabled_for_actions: Boolean(e.enabled_for_actions),
    });
  }

  const rows: any[] = [];
  const eventRows: any[] = [];

  for (const agent of Array.from(byExternalId.values())) {
    const agentId = String(agent.agent_id || agent.id);
    const existing = existingMap.get(agentId);

    // Fetch call logs for this agent
    let callStats = { total: 0, success: 0, failed: 0, lastCall: undefined as string | undefined };
    let recentCalls: Array<{ id: string; status: string; startedAt: string; duration?: number; error?: string }> = [];

    try {
      const callsRes = await fetch(`https://api.retellai.com/list-calls?agent_id=${agentId}&limit=20`, {
        method: "GET",
        headers: retellHeaders,
      });
      if (callsRes.ok) {
        const callsData = await callsRes.json();
        const calls = Array.isArray(callsData) ? callsData : Array.isArray(callsData?.calls) ? callsData.calls : [];

        callStats.total = calls.length;
        callStats.success = calls.filter((c: any) => c.call_status === 'ended' || c.call_status === 'completed').length;
        callStats.failed = calls.filter((c: any) => c.call_status === 'error' || c.call_status === 'failed').length;

        if (calls.length > 0 && calls[0].start_timestamp) {
          callStats.lastCall = new Date(calls[0].start_timestamp * 1000).toISOString();
        }

        recentCalls = calls.slice(0, 5).map((c: any) => ({
          id: String(c.call_id),
          status: c.call_status === 'ended' || c.call_status === 'completed' ? 'success' : 'error',
          startedAt: c.start_timestamp ? new Date(c.start_timestamp * 1000).toISOString() : now,
          duration: c.end_timestamp && c.start_timestamp ? (c.end_timestamp - c.start_timestamp) * 1000 : undefined,
          error: c.disconnection_reason,
        }));

        // Store sample events
        for (const call of calls.slice(0, 10)) {
          eventRows.push({
            tenant_id: membership.tenant_id,
            source_id: sourceId,
            platform_event_id: String(call.call_id),
            type: 'agent_call',
            name: `retell:${agent.agent_name || agentId}:call`,
            value: call.call_status === 'ended' || call.call_status === 'completed' ? 1 : 0,
            state: {
              workflow_id: String(call.agent_id || ''),
              workflow_name: call.agent_name || '',
              execution_id: String(call.call_id),
              status: call.call_status === 'ended' ? 'success' : call.call_status || 'unknown',
              started_at: call.start_timestamp || '',
              ended_at: call.end_timestamp || '',
              duration_ms: call.duration_ms || undefined,
              disconnection_reason: call.disconnection_reason || undefined,
              platform: 'retell',
            },
            labels: {
              agent_id: agentId,
              agent_name: agent.agent_name,
              call_id: call.call_id,
              status: call.call_status,
            },
            timestamp: call.start_timestamp ? new Date(call.start_timestamp * 1000).toISOString() : now,
            created_at: now,
          });
        }
      }
    } catch (e) {
      console.error(`[retell import] Failed to fetch calls for agent ${agentId}:`, e);
    }

    // Generate skill_md
    const workflowData: WorkflowData = {
      platform: 'retell',
      id: agentId,
      name: String(agent.agent_name ?? `Agent ${agentId}`),
      description: agent.general_prompt,
      triggers: agent.llm_websocket_url ? [{
        type: 'voice',
        model: agent.llm_websocket_url,
        voice: agent.voice_id,
      }] : [],
      status: agent.last_modification_timestamp ? 'active' : 'inactive',
      isActive: !!agent.last_modification_timestamp,
      createdAt: agent.last_modification_timestamp ? new Date(agent.last_modification_timestamp * 1000).toISOString() : undefined,
      updatedAt: agent.last_modification_timestamp ? new Date(agent.last_modification_timestamp * 1000).toISOString() : undefined,
      executionStats: {
        total: callStats.total,
        success: callStats.success,
        failed: callStats.failed,
        lastRun: callStats.lastCall,
      },
      recentExecutions: recentCalls,
    };

    const skillMd = generateSkillMd(workflowData);

    // Index to workspace
    try {
      await indexWorkflowToWorkspace(workspace, {
        sourceId,
        externalId: agentId,
        displayName: workflowData.name,
        entityKind: 'agent',
        content: JSON.stringify(agent),
      });
    } catch (e) {
      console.error(`[retell import] Failed to index agent ${agentId} to workspace:`, e);
    }

    rows.push({
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      entity_kind: "agent",
      external_id: agentId,
      display_name: workflowData.name,
      skill_md: skillMd, // ✅ NOW POPULATED
      enabled_for_analytics: existing?.enabled_for_analytics ?? false,
      enabled_for_actions: existing?.enabled_for_actions ?? false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  // Upsert source_entities with skill_md
  const { error: upErr } = await supabase.from("source_entities").upsert(rows, {
    onConflict: "source_id,external_id",
  });

  if (upErr) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: upErr.message }, { status: 400 });
  }

  // Insert sample events
  if (eventRows.length > 0) {
    const { error: evErr } = await supabase.from("events").insert(eventRows);
    if (evErr) {
      console.error('[retell import] Failed to insert events:', evErr);
    }
  }

  return NextResponse.json({
    ok: true,
    importedCount: rows.length,
    eventsStored: eventRows.length,
  });
}
