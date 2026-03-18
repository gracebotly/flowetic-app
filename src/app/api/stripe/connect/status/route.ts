import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve tenant
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select(
        "id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarding_complete, stripe_connected_at"
      )
      .eq("id", membership.tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // ── Live sync: if account exists but isn't marked complete, check Stripe directly ──
    // This handles the race condition where the user returns from onboarding
    // before the account.updated webhook arrives, AND handles cases where
    // the webhook endpoint isn't configured for Connect events.
    if (
      tenant.stripe_account_id &&
      (!tenant.stripe_charges_enabled || !tenant.stripe_onboarding_complete)
    ) {
      try {
        const account = await stripe.accounts.retrieve(
          tenant.stripe_account_id
        );

        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const onboardingComplete =
          (account.charges_enabled && account.details_submitted) ?? false;

        // Only update if something actually changed
        if (
          chargesEnabled !== tenant.stripe_charges_enabled ||
          payoutsEnabled !== tenant.stripe_payouts_enabled ||
          onboardingComplete !== tenant.stripe_onboarding_complete
        ) {
          // Use service role to bypass RLS for this write
          const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          await supabaseAdmin
            .from("tenants")
            .update({
              stripe_charges_enabled: chargesEnabled,
              stripe_payouts_enabled: payoutsEnabled,
              stripe_onboarding_complete: onboardingComplete,
              stripe_connected_at:
                chargesEnabled && !tenant.stripe_connected_at
                  ? new Date().toISOString()
                  : tenant.stripe_connected_at,
            })
            .eq("id", tenant.id);

          // Return the fresh data
          return NextResponse.json({
            connected: true,
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            onboarding_complete: onboardingComplete,
            details_submitted: account.details_submitted ?? false,
            stripe_account_id: tenant.stripe_account_id,
            connected_at:
              chargesEnabled && !tenant.stripe_connected_at
                ? new Date().toISOString()
                : tenant.stripe_connected_at,
          });
        }
      } catch (err) {
        // If Stripe API call fails, fall through to returning DB state
        console.error(
          "[stripe/connect/status] Failed to sync from Stripe API:",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Return current DB state (either already up to date, or Stripe API failed)
    // For the fallback path, infer details_submitted from onboarding_complete
    // (if onboarding_complete is true, details were definitely submitted)
    return NextResponse.json({
      connected: !!tenant.stripe_account_id,
      charges_enabled: tenant.stripe_charges_enabled,
      payouts_enabled: tenant.stripe_payouts_enabled ?? false,
      onboarding_complete: tenant.stripe_onboarding_complete,
      details_submitted: tenant.stripe_onboarding_complete ?? false,
      stripe_account_id: tenant.stripe_account_id,
      connected_at: tenant.stripe_connected_at,
    });
  } catch (error) {
    console.error("[stripe/connect/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Stripe status" },
      { status: 500 }
    );
  }
}
