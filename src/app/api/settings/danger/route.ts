import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// How many days before permanent purge
const GRACE_PERIOD_DAYS = 30;

// ── POST /api/settings/danger ───────────────────────────────
// action: 'export' — downloads all tenant data as JSON.
// action: 'restore' — cancels a pending soft-delete (reactivates workspace).
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

  if (body.action === "restore") {
    // Reactivate a soft-deleted workspace within the grace period
    const { error: restoreError } = await supabaseAdmin
      .from("tenants")
      .update({
        deleted_at: null,
        scheduled_purge_at: null,
        deleted_by: null,
      })
      .eq("id", auth.tenantId);

    if (restoreError) {
      console.error("[POST /api/settings/danger] Restore failed:", restoreError);
      return json(500, { ok: false, code: "RESTORE_FAILED" });
    }

    return json(200, { ok: true, message: "Workspace restored." });
  }

  if (body.action !== "export") {
    return json(400, { ok: false, code: "INVALID_ACTION" });
  }

  // Fetch all tenant data
  const [clients, offerings, sources, events] = await Promise.all([
    auth.supabase.from("clients").select("*").eq("tenant_id", auth.tenantId),
    auth.supabase.from("client_portals").select("*").eq("tenant_id", auth.tenantId),
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
// Soft-deletes the workspace with a 30-day grace period.
// Admin only. Requires body: { confirm: "DELETE MY WORKSPACE" }
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

  const now = new Date();
  const purgeAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // Soft-delete: mark tenant as deleted with scheduled purge date
  const { error: softDeleteError } = await supabaseAdmin
    .from("tenants")
    .update({
      deleted_at: now.toISOString(),
      scheduled_purge_at: purgeAt.toISOString(),
      deleted_by: auth.userId,
    })
    .eq("id", auth.tenantId);

  if (softDeleteError) {
    console.error("[DELETE /api/settings/danger] Soft-delete failed:", softDeleteError);
    return json(500, { ok: false, code: "DELETE_FAILED" });
  }

  // Sign out the current user session
  await auth.supabase.auth.signOut();

  return json(200, {
    ok: true,
    message: `Workspace scheduled for permanent deletion on ${purgeAt.toISOString().split("T")[0]}.`,
    scheduled_purge_at: purgeAt.toISOString(),
  });
}
