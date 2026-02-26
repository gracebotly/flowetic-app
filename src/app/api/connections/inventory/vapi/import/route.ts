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
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

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
  if (String(source.type) !== "vapi") return NextResponse.json({ ok: false, code: "VAPI_SOURCE_REQUIRED" }, { status: 400 });

  const decrypted = source.secret_hash ? decryptSecret(String(source.secret_hash)) : "";
  let secretJson: any = null;
  try {
    secretJson = decrypted ? JSON.parse(decrypted) : null;
  } catch {
    secretJson = null;
  }

  const apiKey = String(secretJson?.apiKey || "").trim();
  if (!apiKey) return NextResponse.json({ ok: false, code: "MISSING_API_KEY" }, { status: 400 });

  const vapiHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Fetch assistants list
  const assistantsRes = await fetch("https://api.vapi.ai/assistant", {
    method: "GET",
    headers: vapiHeaders,
  });

  if (!assistantsRes.ok) {
    const text = await assistantsRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, code: "VAPI_ASSISTANTS_FETCH_FAILED", message: `Failed to fetch Vapi assistants (${assistantsRes.status}).` },
      { status: 400 },
    );
  }

  const assistantsRaw = await assistantsRes.json().catch(() => []);
  const assistants = Array.isArray(assistantsRaw) ? assistantsRaw : Array.isArray(assistantsRaw?.assistants) ? assistantsRaw.assistants : [];

  if (assistants.length === 0) {
    return NextResponse.json({
      ok: true,
      importedCount: 0,
      warning: "No Vapi assistants found.",
    });
  }

  // Clear existing workflows
  try {
    await clearSourceWorkflows(workspace, sourceId);
  } catch (e) {
    console.error('[vapi import] Failed to clear workspace workflows:', e);
  }

  const now = new Date().toISOString();
  const byExternalId = new Map<string, any>();

  for (const a of assistants) {
    const externalId = String(a?.id ?? "").trim();
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

  for (const assistant of Array.from(byExternalId.values())) {
    const assistantId = String(assistant.id);
    const existing = existingMap.get(assistantId);

    // Fetch call logs for this assistant
    let callStats = { total: 0, success: 0, failed: 0, lastCall: undefined as string | undefined };
    let recentCalls: Array<{ id: string; status: string; startedAt: string; duration?: number; error?: string }> = [];

    try {
      const callsRes = await fetch(`https://api.vapi.ai/call?assistantId=${assistantId}&limit=20`, {
        method: "GET",
        headers: vapiHeaders,
      });
      if (callsRes.ok) {
        const callsData = await callsRes.json();
        const calls = Array.isArray(callsData) ? callsData : Array.isArray(callsData?.calls) ? callsData.calls : [];

        callStats.total = calls.length;
        callStats.success = calls.filter((c: any) => c.status === 'completed' || c.status === 'ended').length;
        callStats.failed = calls.filter((c: any) => c.status === 'failed' || c.status === 'error').length;

        if (calls.length > 0 && calls[0].createdAt) {
          callStats.lastCall = calls[0].createdAt;
        }

        recentCalls = calls.slice(0, 5).map((c: any) => ({
          id: String(c.id),
          status: c.status === 'completed' || c.status === 'ended' ? 'success' : 'error',
          startedAt: c.createdAt || c.startedAt,
          duration: c.endedAt && c.startedAt ? new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime() : undefined,
          error: c.error?.message,
        }));

        // Store sample events
        for (const call of calls.slice(0, 10)) {
          eventRows.push({
            tenant_id: membership.tenant_id,
            source_id: sourceId,
            platform_event_id: String(call.id),
            type: 'assistant_call',
            name: `vapi:${assistant.name || assistantId}:call`,
            value: call.status === 'completed' || call.status === 'ended' ? 1 : 0,
            state: {
              workflow_id: String(call.assistant_id || ''),
              workflow_name: call.assistant?.name || '',
              execution_id: String(call.id),
              status: call.status === 'ended' ? 'success' : call.status || 'unknown',
              started_at: call.startedAt || call.createdAt || '',
              ended_at: call.endedAt || '',
              duration_ms: call.duration || undefined,
              ended_reason: call.endedReason || undefined,
              cost: typeof call.cost === 'number' ? call.cost : undefined,
              platform: 'vapi',
            },
            labels: {
              assistant_id: assistantId,
              assistant_name: assistant.name,
              call_id: call.id,
              status: call.status,
            },
            timestamp: call.createdAt || now,
            created_at: now,
          });
        }
      }
    } catch (e) {
      console.error(`[vapi import] Failed to fetch calls for assistant ${assistantId}:`, e);
    }

    // Generate skill_md
    const workflowData: WorkflowData = {
      platform: 'vapi',
      id: assistantId,
      name: String(assistant.name ?? `Assistant ${assistantId}`),
      description: assistant.firstMessage,
      triggers: assistant.model ? [{
        type: 'voice',
        model: assistant.model?.model || assistant.model?.provider,
        voice: assistant.voice?.voice || assistant.voice?.provider,
      }] : [],
      status: assistant.serverUrl ? 'active' : 'inactive',
      isActive: !!assistant.serverUrl,
      createdAt: assistant.createdAt,
      updatedAt: assistant.updatedAt,
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
        externalId: assistantId,
        displayName: workflowData.name,
        entityKind: 'assistant',
        content: JSON.stringify(assistant),
      });
    } catch (e) {
      console.error(`[vapi import] Failed to index assistant ${assistantId} to workspace:`, e);
    }

    rows.push({
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      entity_kind: "assistant",
      external_id: assistantId,
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
      console.error('[vapi import] Failed to insert events:', evErr);
    }
  }

  return NextResponse.json({
    ok: true,
    importedCount: rows.length,
    eventsStored: eventRows.length,
  });
}
