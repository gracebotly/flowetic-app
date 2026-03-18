import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";
import { checkTeamLimit } from "@/lib/plans/checkLimits";
import { validateEmail } from "@/lib/validation/email";

export const runtime = "nodejs";

type TeamMemberRow = {
  id: string;
  user_id: string;
  role: string;
  invite_status: string;
  invited_email: string | null;
  created_at: string;
  users: Array<{ email: string | null; name: string | null }> | null;
};

type PendingInviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/settings/team ──────────────────────────────────
export async function GET() {
  const auth = await getTenantAdmin();
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  // Active members from memberships
  const { data: members, error: mErr } = await auth.supabase
    .from("memberships")
    .select(`
      id,
      user_id,
      role,
      invite_status,
      invited_email,
      created_at,
      users!memberships_user_id_fkey ( email, name )
    `)
    .eq("tenant_id", auth.tenantId)
    .eq("invite_status", "active")
    .order("created_at", { ascending: true });

  if (mErr) {
    console.error("[GET /api/settings/team] Members fetch failed:", mErr);
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  const teamMembers = (members ?? []).map((m: TeamMemberRow) => ({
    id: m.id,
    user_id: m.user_id,
    email: m.users?.[0]?.email ?? m.invited_email ?? "Unknown",
    name: m.users?.[0]?.name ?? null,
    role: m.role,
    invite_status: "active",
    created_at: m.created_at,
    is_you: m.user_id === auth.userId,
  }));

  // Pending invites from team_invites
  const { data: pendingInvites, error: iErr } = await auth.supabase
    .from("team_invites")
    .select("id, email, role, status, created_at, expires_at")
    .eq("tenant_id", auth.tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (iErr) {
    console.error("[GET /api/settings/team] Invites fetch failed:", iErr);
  }

  const pendingMembers = (pendingInvites ?? []).map((inv: PendingInviteRow) => ({
    id: inv.id,
    user_id: "",
    email: inv.email,
    name: null,
    role: inv.role,
    invite_status: "pending",
    created_at: inv.created_at,
    expires_at: inv.expires_at,
    is_you: false,
    is_invite: true,
  }));

  return json(200, {
    ok: true,
    members: [...teamMembers, ...pendingMembers],
  });
}

// ── POST /api/settings/team ─────────────────────────────────
export async function POST(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as { email?: string; role?: string };
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const role = body.role ?? "viewer";

  // ── Email validation with typo detection ──────────────────
  const emailResult = validateEmail(body.email ?? "");

  if (!emailResult.valid) {
    if (emailResult.code === "TYPO_DETECTED") {
      return json(400, {
        ok: false,
        code: "TYPO_DETECTED",
        message: emailResult.message,
        suggestion: emailResult.suggestion,
      });
    }
    return json(400, { ok: false, code: "INVALID_EMAIL", message: emailResult.message });
  }

  const email = emailResult.email;

  // ── Self-invite guard ─────────────────────────────────────
  const { data: selfUser } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", auth.userId)
    .maybeSingle();

  if (selfUser?.email?.toLowerCase() === email) {
    return json(400, {
      ok: false,
      code: "CANNOT_INVITE_SELF",
      message: "You cannot invite yourself.",
    });
  }

  // ── Role validation ───────────────────────────────────────
  const validRoles = ["admin", "client", "viewer"];
  if (!validRoles.includes(role)) {
    return json(400, { ok: false, code: "INVALID_ROLE" });
  }

  // ── Plan seat limit check ─────────────────────────────────
  try {
    const teamLimit = await checkTeamLimit(auth.supabase, auth.tenantId);
    if (!teamLimit.allowed) {
      const message =
        teamLimit.reason === "trial_expired"
          ? "Your free trial has expired. Please subscribe to continue."
          : teamLimit.reason === "plan_inactive"
            ? "Your subscription is not active. Please update your billing."
            : `Team seat limit reached (${teamLimit.current}/${teamLimit.limit}). Upgrade to Scale for unlimited team members.`;
      return json(403, {
        ok: false,
        code: "SEAT_LIMIT_REACHED",
        message,
        reason: teamLimit.reason,
        current: teamLimit.current,
        limit: teamLimit.limit,
      });
    }
  } catch (err) {
    console.error("[POST /api/settings/team] Seat limit check failed:", err);
  }

  // ── Already a member? ─────────────────────────────────────
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    const { data: existingMembership } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("user_id", existingUser.id)
      .eq("invite_status", "active")
      .maybeSingle();

    if (existingMembership) {
      return json(409, { ok: false, code: "ALREADY_MEMBER" });
    }
  }

  // ── Already invited? ──────────────────────────────────────
  const { data: existingInvite } = await supabaseAdmin
    .from("team_invites")
    .select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) {
    return json(409, { ok: false, code: "ALREADY_INVITED" });
  }

  // ── Create the invite ─────────────────────────────────────
  const { data: invite, error: insertErr } = await supabaseAdmin
    .from("team_invites")
    .insert({
      tenant_id: auth.tenantId,
      email,
      role,
      invited_by: auth.userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id, token, email, role")
    .single();

  if (insertErr || !invite) {
    console.error("[POST /api/settings/team] Insert failed:", insertErr);
    return json(500, { ok: false, code: "INVITE_FAILED", message: insertErr?.message });
  }

  // Get tenant and inviter info for email context
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", auth.tenantId)
    .maybeSingle();

  const { data: inviter } = await supabaseAdmin
    .from("users")
    .select("email, name")
    .eq("id", auth.userId)
    .maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.getflowetic.com";
  const inviteLink = `${siteUrl}/invite/${invite.token}`;

  // Send invite email
  if (!existingUser) {
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${siteUrl}/invite/${invite.token}`,
        data: {
          invite_token: invite.token,
          tenant_name: tenant?.name || "a workspace",
          invited_by: inviter?.name || inviter?.email || "A team admin",
        },
      }
    );
    if (inviteErr) {
      console.error("[POST /api/settings/team] Email send failed:", inviteErr);
    }
  } else {
    const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${siteUrl}/invite/${invite.token}` },
    });
    if (linkErr) {
      console.error("[POST /api/settings/team] Magic link failed:", linkErr);
    }
  }

  return json(200, {
    ok: true,
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      invite_link: inviteLink,
      tenant_name: tenant?.name || "Workspace",
      inviter_name: inviter?.name || inviter?.email || "",
    },
  });
}
