import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        "stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarding_complete, stripe_connected_at"
      )
      .eq("id", membership.tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      connected: !!tenant.stripe_account_id,
      charges_enabled: tenant.stripe_charges_enabled,
      payouts_enabled: tenant.stripe_payouts_enabled ?? false,
      onboarding_complete: tenant.stripe_onboarding_complete,
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
