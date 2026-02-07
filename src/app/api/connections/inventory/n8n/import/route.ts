import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";
import { workspace } from '@/mastra/workspace';
import { indexWorkflowToWorkspace, clearSourceWorkflows } from '@/mastra/lib/workflowIndexer';

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
  // n8n can return: [ ... ]
  if (Array.isArray(raw)) return raw;

  // or { data: [ ... ] }
  if (Array.isArray(raw.data)) return raw.data;

  // or { workflows: [ ... ] }
  if (Array.isArray(raw.workflows)) return raw.workflows;

  // or { data: { data: [ ... ] } } (some proxies/wrappers)
  if (raw.data && Array.isArray(raw.data.data)) return raw.data.data;

  return [];
}

export async function POST(req: Request) {
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

  // ADD: Clear existing workflows for this source (replace mode)
  await clearSourceWorkflows(workspace, sourceId);

  // ADD: Index each workflow to workspace
  for (const wf of workflows) {
    await indexWorkflowToWorkspace(workspace, {
      sourceId,
      externalId: String(wf.id),
      displayName: String(wf.name ?? `Workflow ${wf.id}`),
      entityKind: 'workflow',
      content: JSON.stringify(wf.nodes || wf),
    });
  }

  // IMPORTANT: don't silently "succeed" with 0 unless it is truly empty.
  // If your instance has workflows but you still see 0, you'll now have a clear response.
  if (workflows.length === 0) {
    return NextResponse.json({
      ok: true,
      importedCount: 0,
      warning: "No workflows returned by n8n. Check if your n8n instance has workflows and that API user can access them.",
    });
  }

  const now = new Date().toISOString();

  // Deduplicate by external_id to avoid Postgres "cannot affect row a second time" error
  const byExternalId = new Map<string, any>();
  for (const w of workflows) {
    const k = String(w.id || "").trim();
    if (!k) continue;
    if (!byExternalId.has(k)) byExternalId.set(k, w);
  }
  const dedupedWorkflows = Array.from(byExternalId.values());
  const allExternalIds = dedupedWorkflows.map((w) => String(w.id));

  // Fetch existing entities for this source to preserve their enabled_for_analytics status
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

  const rows = dedupedWorkflows.map((w) => {
    const exId = String(w.id);
    const existing = existingMap.get(exId);
    return {
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      entity_kind: "workflow",
      external_id: exId,
      display_name: String(w.name ?? `Workflow ${w.id}`),
      // Preserve existing indexed status; default to false for new entities
      enabled_for_analytics: existing?.enabled_for_analytics ?? false,
      enabled_for_actions: existing?.enabled_for_actions ?? false,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    };
  });

  const { error: upErr } = await supabase.from("source_entities").upsert(rows, {
    onConflict: "source_id,external_id",
  });

  if (upErr) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, importedCount: rows.length });
}
