import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── PATCH /api/settings/team/[id] ───────────────────────────
// Updates a member's role. Admin only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: { role?: string };
  try {
    body = (await req.json()) as { role?: string };
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const newRole = body.role;
  // Validate against existing CHECK constraint
  const validRoles = ["admin", "client", "viewer"];
  if (!newRole || !validRoles.includes(newRole)) {
    return json(400, { ok: false, code: "INVALID_ROLE" });
  }

  // Cannot change your own role
  const { data: targetMember } = await auth.supabase
    .from("memberships")
    .select("id, user_id, role")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (!targetMember) {
    return json(404, { ok: false, code: "MEMBER_NOT_FOUND" });
  }

  if (targetMember.user_id === auth.userId) {
    return json(400, { ok: false, code: "CANNOT_CHANGE_OWN_ROLE" });
  }

  const { data: updated, error } = await auth.supabase
    .from("memberships")
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .select("id, role")
    .maybeSingle();

  if (error || !updated) {
    console.error("[PATCH /api/settings/team/[id]] Update failed:", error);
    return json(500, { ok: false, code: "UPDATE_FAILED" });
  }

  return json(200, { ok: true, member: updated });
}

// ── DELETE /api/settings/team/[id] ──────────────────────────
// Removes a member from the tenant. Admin only.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  // Look up the target member
  const { data: targetMember } = await auth.supabase
    .from("memberships")
    .select("id, user_id, role")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (!targetMember) {
    return json(404, { ok: false, code: "MEMBER_NOT_FOUND" });
  }

  // Cannot remove yourself if you're the only admin
  if (targetMember.user_id === auth.userId) {
    const { count } = await auth.supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", auth.tenantId)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return json(400, { ok: false, code: "LAST_ADMIN" });
    }
  }

  const { error } = await auth.supabase
    .from("memberships")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) {
    console.error("[DELETE /api/settings/team/[id]] Delete failed:", error);
    return json(500, { ok: false, code: "DELETE_FAILED" });
  }

  return json(200, { ok: true });
}
