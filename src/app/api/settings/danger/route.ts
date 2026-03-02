import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── POST /api/settings/danger ───────────────────────────────
// action: 'export' — downloads all tenant data as JSON.
// Admin only.
export async function POST(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  if (body.action !== "export") {
    return json(400, { ok: false, code: "INVALID_ACTION" });
  }

  // Fetch all tenant data
  const [clients, offerings, sources, events] = await Promise.all([
    auth.supabase.from("clients").select("*").eq("tenant_id", auth.tenantId),
    auth.supabase.from("offerings").select("*").eq("tenant_id", auth.tenantId),
    auth.supabase.from("sources").select("id, type, name, status, created_at").eq("tenant_id", auth.tenantId),
    auth.supabase
      .from("events")
      .select("*")
      .eq("tenant_id", auth.tenantId)
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    tenant_id: auth.tenantId,
    clients: clients.data ?? [],
    offerings: offerings.data ?? [],
    sources: sources.data ?? [],
    events_last_90_days: events.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="getflowetic-export-${auth.tenantId.slice(0, 8)}.json"`,
    },
  });
}

// ── DELETE /api/settings/danger ──────────────────────────────
// Permanently deletes the workspace. Admin only.
// Requires body: { confirm: "DELETE MY WORKSPACE" }
export async function DELETE(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  if (body.confirm !== "DELETE MY WORKSPACE") {
    return json(400, { ok: false, code: "CONFIRMATION_REQUIRED" });
  }

  // Delete in order to respect FK constraints.
  // memberships has ON DELETE CASCADE from tenants, but we delete explicitly
  // for clarity and to handle tables that might not have CASCADE.

  const deletions = [
    auth.supabase.from("events").delete().eq("tenant_id", auth.tenantId),
    auth.supabase.from("offerings").delete().eq("tenant_id", auth.tenantId),
    auth.supabase.from("clients").delete().eq("tenant_id", auth.tenantId),
    auth.supabase.from("sources").delete().eq("tenant_id", auth.tenantId),
    auth.supabase.from("memberships").delete().eq("tenant_id", auth.tenantId),
  ];

  const results = await Promise.all(deletions);
  const failedDeletion = results.find((r) => r.error);
  if (failedDeletion?.error) {
    console.error("[DELETE /api/settings/danger] Cleanup failed:", failedDeletion.error);
    return json(500, { ok: false, code: "CLEANUP_FAILED" });
  }

  // Delete tenant last (after all references removed)
  const { error: tenantError } = await auth.supabase
    .from("tenants")
    .delete()
    .eq("id", auth.tenantId);

  if (tenantError) {
    console.error("[DELETE /api/settings/danger] Tenant delete failed:", tenantError);
    return json(500, { ok: false, code: "TENANT_DELETE_FAILED" });
  }

  // Clean up logo storage
  const { data: logoFiles } = await auth.supabase.storage
    .from("logos")
    .list(auth.tenantId);

  if (logoFiles && logoFiles.length > 0) {
    await auth.supabase.storage
      .from("logos")
      .remove(logoFiles.map((f) => `${auth.tenantId}/${f.name}`));
  }

  return json(200, { ok: true, message: "Workspace permanently deleted." });
}
