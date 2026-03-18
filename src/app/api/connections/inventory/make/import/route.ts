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
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required." }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED", message: "Access denied." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = String(body?.sourceId ?? "").trim();
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID", message: "Source ID is missing." }, { status: 400 });

  const { data: source } = await supabase
    .from("sources")
    .select("id, tenant_id, type, method, secret_hash")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND", message: "Source not found." }, { status: 404 });
  if (String(source.type) !== "make") return NextResponse.json({ ok: false, code: "MAKE_SOURCE_REQUIRED", message: "This endpoint only works with Make.com sources." }, { status: 400 });

  if (String(source.method) === "webhook") {
    return NextResponse.json({
      ok: false,
      code: "MAKE_LEGACY_WEBHOOK_CONNECTION",
      message: "This Make connection was created in legacy webhook mode. Manage Indexed requires a Make API token + region. Please Edit Make credentials and reconnect using API.",
    }, { status: 400 });
  }

  // Get Make credentials
  const secret = JSON.parse(decryptSecret(source.secret_hash)) as {
    apiKey?: string;
    region?: string;
    organizationId?: number;
  };

  if (!secret.apiKey || !secret.region) {
    return NextResponse.json({ ok: false, code: "MAKE_API_REQUIRED", message: "Make API token and region are required." }, { status: 400 });
  }

  const region = secret.region;
  const apiKey = secret.apiKey;
  const makeHeaders = { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" };

  // Get organizations
  const orgRes = await fetch(`https://${region}.make.com/api/v2/organizations`, { method: "GET", headers: makeHeaders });
  if (!orgRes.ok) {
    return NextResponse.json({ ok: false, code: "MAKE_API_FAILED", message: "Failed to fetch organizations." }, { status: 400 });
  }

  const orgJson = await orgRes.json();
  const organizations = Array.isArray(orgJson?.organizations) ? orgJson.organizations : [];

  if (organizations.length === 0) {
    return NextResponse.json({ ok: false, code: "MAKE_NO_ORGANIZATION", message: "No organizations found." }, { status: 400 });
  }

  // Find working organization and fetch scenarios
  let scenarios: any[] = [];
  let workingOrgId: number | null = null;

  for (const org of organizations) {
    const tryRes = await fetch(`https://${region}.make.com/api/v2/scenarios?organizationId=${org.id}`, { method: "GET", headers: makeHeaders });
    if (tryRes.ok) {
      const data = await tryRes.json();
      scenarios = Array.isArray(data?.scenarios) ? data.scenarios : [];
      workingOrgId = org.id;
      break;
    }
  }

  if (!workingOrgId) {
    return NextResponse.json({ ok: false, code: "MAKE_SCENARIOS_FAILED", message: "Failed to fetch scenarios." }, { status: 400 });
  }

  // Clear existing workflows
  try {
    await clearSourceWorkflows(workspace, sourceId);
  } catch (e) {
    console.error('[make import] Failed to clear workspace workflows:', e);
  }

  const now = new Date().toISOString();
  const byExternalId = new Map<string, any>();

  for (const s of scenarios) {
    const externalId = String(s?.id ?? "").trim();
    if (!externalId) continue;
    if (!byExternalId.has(externalId)) byExternalId.set(externalId, s);
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

  for (const scenario of Array.from(byExternalId.values())) {
    const scenarioId = String(scenario.id);
    const existing = existingMap.get(scenarioId);

    // Fetch scenario detail (includes blueprint with modules)
    let detailedScenario = scenario;
    try {
      const detailRes = await fetch(`https://${region}.make.com/api/v2/scenarios/${scenarioId}`, { method: "GET", headers: makeHeaders });
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        detailedScenario = detailData.scenario || detailData;
      }
    } catch (e) {
      console.error(`[make import] Failed to fetch scenario ${scenarioId} details:`, e);
    }

    // Fetch executions for this scenario
    let executionStats = { total: 0, success: 0, failed: 0, lastRun: undefined as string | undefined };
    let recentExecutions: Array<{ id: string; status: string; startedAt: string; duration?: number; error?: string }> = [];

    try {
      const execRes = await fetch(`https://${region}.make.com/api/v2/scenarios/${scenarioId}/logs?pg[limit]=20&pg[sortDir]=desc`, { method: "GET", headers: makeHeaders });
      if (execRes.ok) {
        const execData = await execRes.json();
        const rawExecutions = Array.isArray(execData) ? execData : Array.isArray(execData?.scenarioLogs) ? execData.scenarioLogs : [];

        // Filter to only real executions — the API returns start/stop/modify events too
        const executions = rawExecutions.filter(
          (e: any) => e.type === 'auto' && e.eventType === 'EXECUTION_END'
        );

        executionStats.total = executions.length;
        executionStats.success = executions.filter((e: any) => e.status === 1).length;
        executionStats.failed = executions.filter((e: any) => e.status === 3).length;

        if (executions.length > 0 && executions[0].createdAt) {
          executionStats.lastRun = executions[0].createdAt;
        }

        recentExecutions = executions.slice(0, 5).map((e: any) => ({
          id: String(e.id || e.executionId),
          status: e.status === 1 ? 'success' : 'error',
          startedAt: e.timestamp || e.createdAt || e.startedAt,
          duration: e.duration,
          error: e.error?.message,
        }));

        // Store sample events — MUST include `state` JSONB for events_flat view
        for (const exec of executions) {
          const isSuccess = exec.status === 1;
          const startedAt = exec.timestamp || now;

          eventRows.push({
            tenant_id: membership.tenant_id,
            source_id: sourceId,
            platform_event_id: String(exec.id || exec.executionId),
            type: 'scenario_execution',
            name: `make:${scenario.name || scenarioId}:execution`,
            value: isSuccess ? 1 : 0,
            state: {
              // Identifiers
              workflow_id: scenarioId,
              workflow_name: scenario.name || scenarioId,
              execution_id: String(exec.id || exec.executionId),

              // Status & timing
              status: isSuccess ? 'success' : 'error',
              started_at: startedAt,
              ended_at: '',
              duration_ms: typeof exec.duration === 'number' ? exec.duration : undefined,

              // Workflow metrics
              operations_used: typeof exec.operations === 'number' ? exec.operations : undefined,
              data_transfer_bytes: typeof exec.transfer === 'number' ? exec.transfer : undefined,
              centicredits: typeof exec.centicredits === 'number' ? exec.centicredits : undefined,

              // Error fields
              error_message: exec.error?.message || undefined,
              error_name: exec.error?.name || undefined,

              // Metadata
              is_instant: exec.instant ?? undefined,
              is_replayable: exec.isReplayable ?? undefined,

              platform: 'make',
            },
            labels: {
              scenario_id: scenarioId,
              scenario_name: scenario.name,
              execution_id: String(exec.id || exec.executionId),
              status: isSuccess ? 'success' : 'error',
              platformType: 'make',
            },
            timestamp: startedAt,
            created_at: now,
          });
        }
      }
    } catch (e) {
      console.error(`[make import] Failed to fetch executions for scenario ${scenarioId}:`, e);
    }

    // Extract modules from blueprint
    const blueprint = detailedScenario.blueprint || {};
    const modules = blueprint.flow || blueprint.modules || [];

    // Generate skill_md
    const workflowData: WorkflowData = {
      platform: 'make',
      id: scenarioId,
      name: String(scenario.name ?? `Scenario ${scenarioId}`),
      description: scenario.description,
      modules: modules,
      status: detailedScenario.islinked ? 'active' : 'inactive',
      isActive: detailedScenario.islinked,
      createdAt: detailedScenario.createdAt,
      updatedAt: detailedScenario.updatedAt,
      executionStats,
      recentExecutions,
    };

    const skillMd = generateSkillMd(workflowData);

    // Index to workspace
    try {
      await indexWorkflowToWorkspace(workspace, {
        sourceId,
        externalId: scenarioId,
        displayName: workflowData.name,
        entityKind: 'scenario',
        content: JSON.stringify(blueprint),
      });
    } catch (e) {
      console.error(`[make import] Failed to index scenario ${scenarioId} to workspace:`, e);
    }

    // Build aggregate stats from Make scenario list API
    // These are available even for webhook-triggered scenarios that don't expose individual execution logs
    const aggregateStats: Record<string, unknown> = {};
    // Make's organizationId endpoint may not return `executions`. Fall back to `operations`.
    const execCount = typeof scenario.executions === 'number' ? scenario.executions : undefined;
    const opsCount = typeof scenario.operations === 'number' ? scenario.operations : undefined;
    if (execCount !== undefined) {
      aggregateStats.total_executions = execCount;
    } else if (opsCount !== undefined && opsCount > 0) {
      aggregateStats.total_executions = opsCount;
    }
    if (typeof scenario.operations === 'number') aggregateStats.total_operations = scenario.operations;
    if (typeof scenario.errors === 'number') aggregateStats.total_errors = scenario.errors;
    if (typeof scenario.centicredits === 'number') aggregateStats.total_centicredits = scenario.centicredits;
    if (typeof scenario.transfer === 'number') aggregateStats.data_transfer_bytes = scenario.transfer;
    if (detailedScenario.scheduling?.type) aggregateStats.scheduling_type = detailedScenario.scheduling.type;
    if (detailedScenario.scheduling?.type === 'immediately') aggregateStats.is_instant_trigger = true;
    aggregateStats.updated_at = now;

    rows.push({
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      entity_kind: "scenario",
      external_id: scenarioId,
      display_name: workflowData.name,
      skill_md: skillMd,
      aggregate_stats: Object.keys(aggregateStats).length > 0 ? aggregateStats : null,
      enabled_for_analytics: existing?.enabled_for_analytics ?? false,
      enabled_for_actions: existing?.enabled_for_actions ?? false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  // Upsert source_entities with skill_md
  const { error: upErr } = await supabase.from("source_entities").upsert(rows, { onConflict: "source_id,external_id" });
  if (upErr) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: upErr.message }, { status: 400 });

  // Insert sample events
  if (eventRows.length > 0) {
    const dedupedEvents = Array.from(
      new Map(eventRows.map((r) => [r.platform_event_id, r])).values()
    );
    const { error: evErr } = await supabase
      .from("events")
      .upsert(dedupedEvents, { onConflict: "tenant_id,source_id,platform_event_id", ignoreDuplicates: true });
    if (evErr) {
      console.error('[make import] Failed to insert events:', evErr);
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      importedCount: 0,
      warning: "No Make scenarios returned. Confirm your token has scenarios:read and the selected region is correct.",
    });
  }

  return NextResponse.json({
    ok: true,
    importedCount: rows.length,
    eventsStored: eventRows.length,
  });
}
