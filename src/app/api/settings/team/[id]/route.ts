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
  const validRoles = ["admin", "client", "viewer"];
  if (!newRole || !validRoles.includes(newRole)) {
    return json(400, { ok: false, code: "INVALID_ROLE" });
  }

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
// Removes a member OR revokes a pending invite. Admin only.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  // First, try to find this as a membership
  const { data: targetMember } = await auth.supabase
    .from("memberships")
    .select("id, user_id, role")
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (targetMember) {
    // It's a membership — remove it
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

  // Not a membership — try team_invites (revoke pending invite)
  const { error: revokeErr } = await supabaseAdmin
    .from("team_invites")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId)
    .eq("status", "pending");

  if (revokeErr) {
    console.error("[DELETE /api/settings/team/[id]] Revoke failed:", revokeErr);
    return json(500, { ok: false, code: "REVOKE_FAILED" });
  }

  return json(200, { ok: true });
}
