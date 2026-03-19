import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { TRIAL_DAYS_WITHOUT_CARD } from "@/lib/plans/constants";

// Service role client — bypasses RLS for tenant + membership creation
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/control-panel/connections";

  // trial=7 (default) → 7-day free trial, no card required
  // trial=0           → pay-now, redirect straight to billing
  // Google OAuth users always land here with no trial param → defaults to 7
  const trialParam = searchParams.get("trial") ?? "7";
  const planParam = searchParams.get("plan") ?? "agency";
  const plan = planParam === "scale" ? "scale" : "agency";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const intent = searchParams.get("intent") ?? "signin";

  if (user) {
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1);

    const isNewUser = !mErr && (!memberships || memberships.length === 0);

    // ── Existing user: check if their workspace is soft-deleted ──
    if (!isNewUser && memberships && memberships.length > 0) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("deleted_at, scheduled_purge_at")
        .eq("id", memberships[0].tenant_id)
        .single();

      if (tenant?.deleted_at) {
        // Workspace is soft-deleted — sign out and reject
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=workspace_deleted", request.url)
        );
      }
    }

    if (isNewUser && intent !== "signup") {
      // No membership and not signing up — this is an orphan user.
      // Do NOT call ensure-tenant. Sign out and reject.
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=not_registered", request.url)
      );
    }

    if (isNewUser && intent === "signup") {
      const workspaceName = user.email
        ? `${user.email.split("@")[0]}'s Workspace`
        : "My Workspace";

      // trial=0 → pay-now (no trial period), everyone else gets 7 days
      const trialDays = trialParam === "0" ? 0 : TRIAL_DAYS_WITHOUT_CARD;

      const { data: tenant, error: tErr } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: workspaceName,
          plan,
          plan_status: "trialing",
          has_card_on_file: false,
          trial_ends_at:
            trialDays > 0
              ? new Date(
                  Date.now() + trialDays * 24 * 60 * 60 * 1000
                ).toISOString()
              : null,
        })
        .select()
        .single();

      if (!tErr && tenant) {
        await supabaseAdmin.from("memberships").insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role: "admin",
        });
      }
    }
  }

  // Pay-now: send to billing immediately
  const destination =
    trialParam === "0"
      ? `/control-panel/settings?tab=billing&intent=subscribe&plan=${plan}`
      : next;

  return NextResponse.redirect(new URL(destination, request.url));
}
