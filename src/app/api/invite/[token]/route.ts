import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/invite/[token] ─────────────────────────────────
export const GET = withApiHandler(async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

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
    if (invite.status !== "expired") {
      await supabaseAdmin
        .from("team_invites")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
    return json(400, { ok: false, code: "INVITE_EXPIRED" });
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", invite.tenant_id)
    .maybeSingle();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const emailMatch = isAuthenticated
    ? (user.email ?? "").toLowerCase() === invite.email.toLowerCase()
    : null;

  return json(200, {
    ok: true,
    tenant_name: tenant?.name || "a workspace",
    role: invite.role,
    email: invite.email,
    is_authenticated: isAuthenticated,
    user_email: user?.email || null,
    email_match: emailMatch,
  });
});

// ── POST /api/invite/[token] ────────────────────────────────
export const POST = withApiHandler(async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return json(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select("id, tenant_id, email, role, status, expires_at")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !invite) {
    return json(404, { ok: false, code: "INVITE_NOT_FOUND" });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin
      .from("team_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    return json(400, { ok: false, code: "INVITE_EXPIRED" });
  }

  // ═══════════════════════════════════════════════════════════
  // EMAIL MISMATCH GUARD
  // If logged-in email != invite email → reject immediately.
  // Do NOT touch the invite status — it stays pending for the
  // correct person to accept.
  // ═══════════════════════════════════════════════════════════
  const userEmail = (user.email ?? "").toLowerCase();
  const inviteEmail = invite.email.toLowerCase();

  if (userEmail !== inviteEmail) {
    return json(403, {
      ok: false,
      code: "EMAIL_MISMATCH",
      message: `This invite is for ${invite.email}. You are signed in as ${user.email}.`,
      invite_email: invite.email,
      current_email: user.email,
    });
  }

  // Already a member of this tenant?
  const { data: existingMembership } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("tenant_id", invite.tenant_id)
    .eq("user_id", user.id)
    .eq("invite_status", "active")
    .maybeSingle();

  if (existingMembership) {
    await supabaseAdmin
      .from("team_invites")
      .update({ status: "accepted", accepted_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", invite.id);
    return json(409, { ok: false, code: "ALREADY_MEMBER" });
  }

  // Ensure public.users row
  const { data: publicUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!publicUser) {
    await supabaseAdmin.from("users").insert({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || user.email?.split("@")[0] || "",
    });
  }

  // Create membership
  const { error: memberErr } = await supabaseAdmin.from("memberships").insert({
    tenant_id: invite.tenant_id,
    user_id: user.id,
    role: invite.role,
    invite_status: "active",
    invited_email: invite.email,
  });

  if (memberErr) {
    console.error("[POST /api/invite] Membership create failed:", memberErr);
    return json(500, { ok: false, code: "ACCEPT_FAILED", message: memberErr.message });
  }

  // Mark invite accepted
  await supabaseAdmin
    .from("team_invites")
    .update({ status: "accepted", accepted_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", invite.id);

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
});
