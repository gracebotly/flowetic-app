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

        // Store enriched events — fetch full detail per call for rich data
        for (const call of calls.slice(0, 20)) {
          let enrichedCall = call;
          try {
            const detailRes = await fetch(`https://api.vapi.ai/call/${call.id}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (detailRes.ok) {
              enrichedCall = await detailRes.json();
            }
          } catch {
            // Fall back to list data if detail fetch fails
          }

          const startedAt = enrichedCall.startedAt || enrichedCall.createdAt;
          const endedAt = enrichedCall.endedAt;
          const durationMs = (endedAt && startedAt)
            ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
            : undefined;

          eventRows.push({
            tenant_id: membership.tenant_id,
            source_id: sourceId,
            platform_event_id: String(enrichedCall.id),
            type: 'assistant_call',
            name: `vapi:${assistant.name || assistantId}:call`,
            value: enrichedCall.status === 'completed' || enrichedCall.status === 'ended' ? 1 : 0,
            state: {
              // Identifiers
              workflow_id: String(enrichedCall.assistantId || enrichedCall.assistant_id || ''),
              workflow_name: enrichedCall.assistant?.name || assistant.name || '',
              execution_id: String(enrichedCall.id),
              platform: 'vapi',

              // Status & timing
              status: enrichedCall.status === 'ended' ? 'success' : enrichedCall.status || 'unknown',
              started_at: startedAt || '',
              ended_at: endedAt || '',
              duration_ms: durationMs,
              ended_reason: enrichedCall.endedReason || undefined,

              // Cost (Vapi returns dollars, no conversion needed)
              cost: typeof enrichedCall.cost === 'number' ? enrichedCall.cost : undefined,
              cost_breakdown: enrichedCall.costBreakdown || undefined,

              // Rich voice fields from full call detail
              call_type: enrichedCall.type || undefined,
              call_summary: enrichedCall.analysis?.summary || undefined,
              call_successful: enrichedCall.analysis?.successEvaluation || undefined,
              transcript: enrichedCall.artifact?.transcript || undefined,
              recording_url: enrichedCall.artifact?.recordingUrl
                || enrichedCall.artifact?.recording?.stereoUrl
                || enrichedCall.artifact?.recording?.mono?.combinedUrl
                || undefined,
              sentiment: enrichedCall.analysis?.structuredData?.sentiment || undefined,
              user_sentiment: enrichedCall.analysis?.structuredData?.sentiment || undefined,

              // Vapi-specific extras
              structured_data: enrichedCall.analysis?.structuredData || undefined,
              success_evaluation: enrichedCall.analysis?.successEvaluation || undefined,
            },
            labels: {
              assistant_id: assistantId,
              assistant_name: assistant.name,
              call_id: enrichedCall.id,
              status: enrichedCall.status,
            },
            timestamp: enrichedCall.createdAt || now,
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
    const dedupedEvents = Array.from(
      new Map(eventRows.map((r) => [r.platform_event_id, r])).values()
    );
    const { error: evErr } = await supabase
      .from("events")
      .upsert(dedupedEvents, { onConflict: "tenant_id,source_id,platform_event_id", ignoreDuplicates: true });
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
