import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";
import { workspace } from '@/mastra/workspace';
import { indexWorkflowToWorkspace, clearSourceWorkflows } from '@/mastra/lib/workflowIndexer';
import { generateSkillMd, type WorkflowData } from '@/mastra/lib/skillMdGenerator';

export const runtime = "nodejs";

function normalizeBaseUrl(instanceUrl?: string | null) {
  if (!instanceUrl) return null;
  try {
    const u = new URL(instanceUrl);
    return u.origin;
  } catch {
    return null;
  }
}

function extractWorkflows(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.workflows)) return raw.workflows;
  if (raw.data && Array.isArray(raw.data.data)) return raw.data.data;
  return [];
}

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
  const sourceId = (body.sourceId as string | undefined) ?? "";
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  const { data: source, error: sErr } = await supabase
    .from("sources")
    .select("id,type,secret_hash,tenant_id")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sErr || !source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  if (source.type !== "n8n") return NextResponse.json({ ok: false, code: "INVALID_PLATFORM" }, { status: 400 });
  if (!source.secret_hash) return NextResponse.json({ ok: false, code: "MISSING_SECRET" }, { status: 400 });

  const secret = JSON.parse(decryptSecret(source.secret_hash)) as {
    method: "api" | "webhook";
    apiKey?: string;
    instanceUrl?: string | null;
    authMode?: "header" | "bearer";
  };

  if (secret.method !== "api" || !secret.apiKey) {
    return NextResponse.json({ ok: false, code: "N8N_API_REQUIRED" }, { status: 400 });
  }

  const baseUrl = normalizeBaseUrl(secret.instanceUrl) ?? process.env.N8N_DEFAULT_BASE_URL ?? null;
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, code: "MISSING_INSTANCE_URL", message: "n8n instance URL is required for API import." },
      { status: 400 },
    );
  }

  const headers: Record<string, string> = {};
  if ((secret.authMode ?? "bearer") === "header") headers["X-N8N-API-KEY"] = secret.apiKey!;
  else headers["Authorization"] = `Bearer ${secret.apiKey}`;

  // 1. Fetch all workflows
  const res = await fetch(`${baseUrl}/api/v1/workflows`, { method: "GET", headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { ok: false, code: "N8N_API_FAILED", message: `n8n API request failed (${res.status}). ${text}`.trim() },
      { status: 400 },
    );
  }

  const raw = await res.json().catch(() => null);
  const workflows = extractWorkflows(raw);

  if (workflows.length === 0) {
    return NextResponse.json({
      ok: true,
      importedCount: 0,
      warning: "No workflows returned by n8n. Check if your n8n instance has workflows and that API user can access them.",
    });
  }

  // Clear existing workflows for this source
  try {
    await clearSourceWorkflows(workspace, sourceId);
  } catch (e) {
    console.error('[n8n import] Failed to clear workspace workflows:', e);
  }

  const now = new Date().toISOString();
  const byExternalId = new Map<string, any>();

  for (const w of workflows) {
    const k = String(w.id || "").trim();
    if (!k) continue;
    if (!byExternalId.has(k)) byExternalId.set(k, w);
  }

  const dedupedWorkflows = Array.from(byExternalId.values());
  const allExternalIds = dedupedWorkflows.map((w) => String(w.id));

  // Fetch existing entities to preserve their enabled flags
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

  // 2. For each workflow, fetch detailed info + executions + generate skill_md
  const rows: any[] = [];
  const eventRows: any[] = [];

  for (const wf of dedupedWorkflows) {
    const wfId = String(wf.id);
    const existing = existingMap.get(wfId);

    // Fetch detailed workflow (includes nodes)
    let detailedWorkflow = wf;
    try {
      const detailRes = await fetch(`${baseUrl}/api/v1/workflows/${wfId}`, { method: "GET", headers });
      if (detailRes.ok) {
        detailedWorkflow = await detailRes.json();
      }
    } catch (e) {
      console.error(`[n8n import] Failed to fetch workflow ${wfId} details:`, e);
    }

    // Fetch recent executions for this workflow
    let executionStats = { total: 0, success: 0, failed: 0, lastRun: undefined as string | undefined };
    let recentExecutions: Array<{ id: string; status: string; startedAt: string; duration?: number; error?: string }> = [];

    try {
      const execRes = await fetch(`${baseUrl}/api/v1/executions?workflowId=${wfId}&limit=20`, { method: "GET", headers });
      if (execRes.ok) {
        const execData = await execRes.json();
        const executions = execData.data || execData || [];

        executionStats.total = executions.length;
        // FIX: stoppedAt exists on ALL completed n8n executions. Use exec.status only.
        executionStats.success = executions.filter((e: any) => e.status === 'success').length;
        executionStats.failed = executions.filter((e: any) => e.status === 'error' || e.status === 'crashed').length;

        if (executions.length > 0) {
          executionStats.lastRun = executions[0].startedAt || executions[0].createdAt;
        }

        recentExecutions = executions.slice(0, 5).map((e: any) => ({
          id: String(e.id),
          status: e.status === 'error' || e.status === 'crashed' ? 'error' : 'success',
          startedAt: e.startedAt || e.createdAt,
          duration: e.stoppedAt && e.startedAt
            ? new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
            : undefined,
          error: e.data?.resultData?.error?.message,
        }));

        // Store sample events
        for (const exec of executions.slice(0, 10)) {
          eventRows.push({
            tenant_id: membership.tenant_id,
            source_id: sourceId,
            type: 'workflow_execution',
            name: `n8n:${wf.name || wfId}:execution`,
            value: (exec.status === 'error' || exec.status === 'crashed') ? 0 : 1, // 1 = success, 0 = failure
            labels: {
              workflow_id: wfId,
              workflow_name: wf.name,
              execution_id: exec.id,
              status: (exec.status === 'error' || exec.status === 'crashed') ? 'error' : 'success',
            },
            timestamp: exec.startedAt || exec.createdAt || now,
            created_at: now,
          });
        }
      }
    } catch (e) {
      console.error(`[n8n import] Failed to fetch executions for workflow ${wfId}:`, e);
    }

    // Generate skill_md
    const workflowData: WorkflowData = {
      platform: 'n8n',
      id: wfId,
      name: String(detailedWorkflow.name ?? `Workflow ${wfId}`),
      description: detailedWorkflow.description,
      nodes: detailedWorkflow.nodes || [],
      status: detailedWorkflow.active ? 'active' : 'inactive',
      isActive: detailedWorkflow.active,
      createdAt: detailedWorkflow.createdAt,
      updatedAt: detailedWorkflow.updatedAt,
      executionStats,
      recentExecutions,
    };

    const skillMd = generateSkillMd(workflowData);

    // Index to workspace
    try {
      await indexWorkflowToWorkspace(workspace, {
        sourceId,
        externalId: wfId,
        displayName: workflowData.name,
        entityKind: 'workflow',
        content: JSON.stringify(detailedWorkflow.nodes || detailedWorkflow),
      });
    } catch (e) {
      console.error(`[n8n import] Failed to index workflow ${wfId} to workspace:`, e);
    }

    rows.push({
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      entity_kind: "workflow",
      external_id: wfId,
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
      console.error('[n8n import] Failed to insert events:', evErr);
    }
  }

  return NextResponse.json({
    ok: true,
    importedCount: rows.length,
    eventsStored: eventRows.length,
  });
}
