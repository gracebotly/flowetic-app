

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspace } from '@/mastra/workspace';
import { indexWorkflowToWorkspace, clearSourceWorkflows } from '@/mastra/lib/workflowIndexer';

export const runtime = "nodejs";

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
  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = String(body?.sourceId ?? "").trim();
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  const origin = new URL(req.url).origin;

  const listRes = await fetch(
    `${origin}/api/connections/inventory/retell/list?sourceId=${encodeURIComponent(sourceId)}`,
    {
      method: "GET",
      headers: { cookie: req.headers.get("cookie") ?? "" } as any,
    },
  );

  const listText = await listRes.text().catch(() => "");
  let listJson: any = null;
  try {
    listJson = listText ? JSON.parse(listText) : null;
  } catch {
    listJson = null;
  }

  if (!listRes.ok || !listJson?.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: listJson?.code || "RETELL_LIST_FAILED",
        message: listJson?.message || "Failed to list agents.",
        details: { upstreamStatus: listRes.status, upstreamBodySnippet: listText.slice(0, 300) },
      },
      { status: 400 },
    );
  }

  const inventory = Array.isArray(listJson?.inventoryEntities) ? listJson.inventoryEntities : [];
  
  // ADD: Clear existing workflows for this source
  await clearSourceWorkflows(workspace, sourceId);

  // ADD: Index each workflow to workspace
  for (const wf of inventory) {
    await indexWorkflowToWorkspace(workspace, {
      sourceId,
      externalId: String(wf.externalId),
      displayName: String(wf.displayName || ""),
      entityKind: String(wf.entityKind || "agent"),
      content: JSON.stringify(wf),
    });
  }

  const now = new Date().toISOString();

  // Deduplicate by externalId to avoid Postgres "cannot affect row a second time" error.
  const byExternalId = new Map<string, any>();
  for (const e of inventory) {
    const externalId = String(e?.externalId ?? "").trim();
    if (!externalId) continue;
    if (!byExternalId.has(externalId)) {
      byExternalId.set(externalId, e);
    }
  }

  const allExternalIds = Array.from(byExternalId.keys());

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

  const rows = Array.from(byExternalId.values()).map((a: any) => {
    const exId = String(a.externalId);
    const existing = existingMap.get(exId);
    return {
      tenant_id: membership.tenant_id,
      source_id: sourceId,
      entity_kind: String(a.entityKind || "agent"),
      external_id: exId,
      display_name: String(a.displayName || ""),
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

