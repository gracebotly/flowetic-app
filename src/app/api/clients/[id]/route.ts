import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/logActivity";
import { getUserId } from "@/lib/activity/getUserId";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return membership?.tenant_id ?? null;
}

// ── GET /api/clients/[id] ───────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !client) {
    return json(404, { ok: false, code: "CLIENT_NOT_FOUND" });
  }

  // Get offerings assigned to this client
  const { data: assignedOfferings } = await supabase
    .from("client_portals")
    .select("id, name, surface_type, access_type, platform_type, token, slug, custom_path, status, last_viewed_at")
    .eq("tenant_id", tenantId)
    .eq("client_id", id)
    .neq("status", "archived");

  // Get total offerings for tenant (for health score coverage calc)
  const { count: totalOfferings } = await supabase
    .from("client_portals")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("status", "archived");

  return json(200, {
    ok: true,
    client,
    assigned_offerings: assignedOfferings ?? [],
    total_offerings: totalOfferings ?? 0,
  });
}

// ── PATCH /api/clients/[id] ─────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const allowedFields = [
    "name",
    "company",
    "contact_email",
    "contact_phone",
    "notes",
    "tags",
    "status",
    "health_score",
    "last_seen_at",
    "archived_at",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return json(400, { ok: false, code: "NO_UPDATES" });
  }

  updates.updated_at = new Date().toISOString();

  const { data: client, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  if (error || !client) {
    console.error("[PATCH /api/clients] Update failed:", error);
    return json(500, { ok: false, code: "UPDATE_FAILED" });
  }

  // Log activity event
  const userId = await getUserId(supabase);
  const isRestore = "archived_at" in updates && updates.archived_at === null;
  logActivity(supabase, {
    tenantId,
    actorId: userId,
    actorType: "user",
    category: "client",
    action: isRestore ? "restored" : "updated",
    status: isRestore ? "info" : "success",
    entityType: "client",
    entityId: id,
    entityName: client.name as string,
    message: isRestore ? `Restored client "${client.name}"` : `Updated client "${client.name}"`,
    details: { updated_fields: Object.keys(updates).filter((k) => k !== "updated_at") },
  });

  return json(200, { ok: true, client });
}

// ── DELETE /api/clients/[id] ────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  // Soft-delete: set archived_at
  const { error } = await supabase
    .from("clients")
    .update({
      archived_at: new Date().toISOString(),
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[DELETE /api/clients] Archive failed:", error);
    return json(500, { ok: false, code: "DELETE_FAILED" });
  }

  // Log activity event
  const userId = await getUserId(supabase);
  logActivity(supabase, {
    tenantId,
    actorId: userId,
    actorType: "user",
    category: "client",
    action: "archived",
    status: "info",
    entityType: "client",
    entityId: id,
    message: `Archived client`,
  });

  // Unassign offerings from this client
  await supabase
    .from("client_portals")
    .update({ client_id: null, updated_at: new Date().toISOString() })
    .eq("client_id", id)
    .eq("tenant_id", tenantId);

  return json(200, { ok: true });
}
