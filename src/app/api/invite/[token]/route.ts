import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/invite/[token] ─────────────────────────────────
// Validates an invite token. Returns tenant info if valid.
// Does NOT require auth — we need to show invite details before login.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up invite in team_invites table (service role to bypass RLS)
  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select("id, tenant_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return json(404, { ok: false, code: "INVITE_NOT_FOUND" });
  }

  if (invite.status === "accepted") {
    return json(400, { ok: false, code: "ALREADY_ACCEPTED" });
  }

  if (invite.status === "revoked") {
    return json(400, { ok: false, code: "INVITE_REVOKED" });
  }

  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    // Auto-expire if past date
    if (invite.status !== "expired") {
      await supabaseAdmin
        .from("team_invites")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
    return json(400, { ok: false, code: "INVITE_EXPIRED" });
  }

  // Get tenant name
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", invite.tenant_id)
    .maybeSingle();

  // Check if the current user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return json(200, {
    ok: true,
    tenant_name: tenant?.name || "a workspace",
    role: invite.role,
    email: invite.email,
    is_authenticated: !!user,
    user_email: user?.email || null,
  });
}

// ── POST /api/invite/[token] ────────────────────────────────
// Accepts an invite. Requires authenticated user.
// Creates the real membership row and marks invite as accepted.
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

  // Look up the pending invite
  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select("id, tenant_id, email, role, status, expires_at")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !invite) {
    return json(404, { ok: false, code: "INVITE_NOT_FOUND" });
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin
      .from("team_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    return json(400, { ok: false, code: "INVITE_EXPIRED" });
  }

  // Check if user is already a member
  const { data: existingMembership } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("tenant_id", invite.tenant_id)
    .eq("user_id", user.id)
    .eq("invite_status", "active")
    .maybeSingle();

  if (existingMembership) {
    // Mark invite as accepted anyway
    await supabaseAdmin
      .from("team_invites")
      .update({
        status: "accepted",
        accepted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    return json(409, { ok: false, code: "ALREADY_MEMBER" });
  }

  // Ensure user exists in public.users (trigger should handle this, but be safe)
  const { data: publicUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!publicUser) {
    // Create the public user row
    await supabaseAdmin.from("users").insert({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || user.email?.split("@")[0] || "",
    });
  }

  // Create the membership
  const { error: memberErr } = await supabaseAdmin.from("memberships").insert({
    tenant_id: invite.tenant_id,
    user_id: user.id,
    role: invite.role,
    invite_status: "active",
    invited_email: invite.email,
  });

  if (memberErr) {
    console.error("[POST /api/invite/[token]] Membership create failed:", memberErr);
    return json(500, { ok: false, code: "ACCEPT_FAILED", message: memberErr.message });
  }

  // Mark invite as accepted
  await supabaseAdmin
    .from("team_invites")
    .update({
      status: "accepted",
      accepted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  // Get tenant name
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", invite.tenant_id)
    .maybeSingle();

  return json(200, {
    ok: true,
    tenant_name: tenant?.name || "Workspace",
    role: invite.role,
  });
}
