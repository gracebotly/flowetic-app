import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/invite/[token] ─────────────────────────────────
// Validates an invite token. Returns tenant info if valid.
// Requires authenticated user.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  // Find the membership with this invite token
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, tenant_id, role, invite_status, invited_email")
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !membership) {
    return json(404, { ok: false, code: "INVITE_NOT_FOUND" });
  }

  if (membership.invite_status === "active") {
    return json(400, { ok: false, code: "ALREADY_ACTIVE" });
  }

  if (membership.invite_status === "revoked") {
    return json(400, { ok: false, code: "INVITE_REVOKED" });
  }

  // Get tenant name for display
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", membership.tenant_id)
    .maybeSingle();

  return json(200, {
    ok: true,
    tenant_name: tenant?.name || "Unknown workspace",
    role: membership.role,
    email: membership.invited_email,
  });
}

// ── POST /api/invite/[token] ────────────────────────────────
// Accepts an invite. Updates the membership to active and sets user_id.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  // Find the pending membership
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, tenant_id, user_id, role, invite_status")
    .eq("invite_token", token)
    .eq("invite_status", "pending")
    .maybeSingle();

  if (error || !membership) {
    return json(404, { ok: false, code: "INVITE_NOT_FOUND" });
  }

  // Check if user is already a member of this tenant
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", user.id)
    .eq("invite_status", "active")
    .maybeSingle();

  if (existingMembership) {
    return json(409, { ok: false, code: "ALREADY_MEMBER" });
  }

  // Activate: update user_id to the accepting user + set status to active + clear token
  const { error: updateError } = await supabase
    .from("memberships")
    .update({
      user_id: user.id,
      invite_status: "active",
      invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.id);

  if (updateError) {
    console.error("[POST /api/invite/[token]] Accept failed:", updateError);
    return json(500, { ok: false, code: "ACCEPT_FAILED", message: updateError.message });
  }

  // Get tenant name for response
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", membership.tenant_id)
    .maybeSingle();

  return json(200, {
    ok: true,
    tenant_name: tenant?.name || "Workspace",
    role: membership.role,
  });
}
