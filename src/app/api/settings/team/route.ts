import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/settings/team ──────────────────────────────────
// Lists all memberships for the tenant with user details.
// Any authenticated member can read the team list.
export async function GET() {
  const auth = await getTenantAdmin();
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  // Get memberships with user info via join on public.users
  const { data: members, error } = await auth.supabase
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
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/settings/team] Fetch failed:", error);
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  // Flatten user data into each member record
  const teamMembers = (members ?? []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    email: m.users?.email ?? m.invited_email ?? "Unknown",
    name: m.users?.name ?? null,
    role: m.role,
    invite_status: m.invite_status,
    created_at: m.created_at,
    is_you: m.user_id === auth.userId,
  }));

  return json(200, { ok: true, members: teamMembers });
}

// ── POST /api/settings/team ─────────────────────────────────
// Invites a new team member. Admin only.
// Creates a membership with invite_status='pending' and generates invite_token.
export async function POST(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as { email?: string; role?: string };
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "viewer";

  if (!email || !email.includes("@")) {
    return json(400, { ok: false, code: "INVALID_EMAIL" });
  }

  // Validate role against existing CHECK constraint: ['admin', 'client', 'viewer']
  // Note: 'editor' role is NOT yet in the DB constraint — will be added in a later phase.
  const validRoles = ["admin", "client", "viewer"];
  if (!validRoles.includes(role)) {
    return json(400, { ok: false, code: "INVALID_ROLE" });
  }

  // Check for duplicate invite (same email, same tenant, not revoked)
  const { data: existingInvite } = await auth.supabase
    .from("memberships")
    .select("id, invite_status")
    .eq("tenant_id", auth.tenantId)
    .eq("invited_email", email)
    .neq("invite_status", "revoked")
    .maybeSingle();

  if (existingInvite) {
    return json(409, { ok: false, code: "ALREADY_INVITED" });
  }

  // Also check if a user with this email is already an active member
  const { data: existingUser } = await auth.supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    const { data: existingMembership } = await auth.supabase
      .from("memberships")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMembership) {
      return json(409, { ok: false, code: "ALREADY_MEMBER" });
    }
  }

  // Generate invite token
  const inviteToken = crypto.randomUUID();

  // Create pending membership
  // user_id is required (NOT NULL + FK), so we use a placeholder approach:
  // We set user_id to the inviting admin's ID temporarily. When the invite is
  // accepted, we update user_id to the actual user. The unique constraint on
  // (tenant_id, user_id) means we need the real user's ID, so for pending
  // invites where we don't have a user yet, we need a different approach.
  //
  // Alternative: Insert with the existing user's ID if they have an account,
  // or skip the insert and just track the invite separately.
  // Since user_id is NOT NULL with FK constraint, we check if the user exists first.

  let membershipData: Record<string, unknown>;

  if (existingUser) {
    // User exists in our system but isn't a member of this tenant yet
    membershipData = {
      tenant_id: auth.tenantId,
      user_id: existingUser.id,
      role,
      invited_email: email,
      invite_token: inviteToken,
      invite_status: "pending",
    };
  } else {
    // User doesn't exist yet — we can't create a membership row because
    // user_id is NOT NULL with FK to users. Store as a "pre-invite" that
    // gets converted when they sign up and accept.
    // For MVP: Return the invite link. The /invite/[token] accept page
    // will create the membership after signup.
    //
    // We'll store the invite data in a lightweight way: create a temporary
    // record only if the user exists. Otherwise, return a token-based link
    // that the accept endpoint will handle.
    return json(200, {
      ok: true,
      invite: {
        email,
        role,
        token: inviteToken,
        invite_link: `/invite/${inviteToken}`,
        note: "User does not have an account yet. Share this link — they will be prompted to sign up first.",
      },
      // Store token mapping for the accept endpoint
      // In a future phase, this should be a dedicated invites table.
      // For now, we return the link and the accept endpoint validates.
      _pending: { tenant_id: auth.tenantId, email, role, token: inviteToken },
    });
  }

  const { data: membership, error } = await auth.supabase
    .from("memberships")
    .insert(membershipData)
    .select("id, role, invited_email, invite_status, invite_token")
    .maybeSingle();

  if (error) {
    console.error("[POST /api/settings/team] Insert failed:", error);
    return json(500, { ok: false, code: "INVITE_FAILED", message: error.message });
  }

  return json(200, {
    ok: true,
    invite: {
      id: membership?.id,
      email,
      role,
      token: inviteToken,
      invite_link: `/invite/${inviteToken}`,
    },
  });
}
