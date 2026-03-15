import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  TRIAL_DAYS_WITH_CARD,
  TRIAL_DAYS_WITHOUT_CARD,
} from "@/lib/plans/constants";

// Service role client — bypasses RLS for tenant + membership creation
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/control-panel/connections";

  // trial=14 → 14-day trial (user will add card separately via billing)
  // trial=7  → 7-day trial, no card required
  // trial=0  → pay-now, skip trial, redirect to billing immediately
  const trialParam = searchParams.get("trial") ?? "7";

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

  if (user) {
    // Check if tenant already exists for this user
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1);

    if (!mErr && (!memberships || memberships.length === 0)) {
      const workspaceName = user.email
        ? `${user.email.split("@")[0]}'s Workspace`
        : "My Workspace";

      // Determine trial length from the param passed through email link
      const trialDays =
        trialParam === "14"
          ? TRIAL_DAYS_WITH_CARD
          : trialParam === "0"
            ? 0
            : TRIAL_DAYS_WITHOUT_CARD;

      // Insert tenant using service role (no INSERT RLS policy on tenants)
      const { data: tenant, error: tErr } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: workspaceName,
          plan: "agency",
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
        // Insert membership using service role (INSERT policy requires existing admin)
        await supabaseAdmin.from("memberships").insert({
          tenant_id: tenant.id,
          user_id: user.id,
          role: "admin",
        });
      }
    }
  }

  // Pay-now: send straight to billing so they can subscribe immediately
  const destination =
    trialParam === "0"
      ? "/control-panel/settings?tab=billing&intent=subscribe"
      : next;

  return NextResponse.redirect(new URL(destination, request.url));
}
