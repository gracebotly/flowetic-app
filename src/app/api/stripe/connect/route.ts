import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Resolve tenant via memberships (admin only)
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        { error: "Only admins can connect Stripe" },
        { status: 403 }
      );
    }

    const tenantId = membership.tenant_id;

    // 3. Check if tenant already has a Stripe account
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("stripe_account_id, name")
      .eq("id", tenantId)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let accountId = tenant.stripe_account_id;

    // 4. Create new Express connected account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "company",
        metadata: { tenant_id: tenantId },
        business_profile: {
          name: tenant.name || undefined,
        },
      });

      accountId = account.id;

      // Save account ID to tenant
      const { error: updateErr } = await supabase
        .from("tenants")
        .update({ stripe_account_id: accountId })
        .eq("id", tenantId);

      if (updateErr) {
        console.error("[stripe/connect] Failed to save account ID:", updateErr);
        return NextResponse.json(
          { error: "Failed to save Stripe account" },
          { status: 500 }
        );
      }
    }

    // 5. Create Account Link for Stripe-hosted onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/control-panel/settings?tab=billing&stripe=refresh`,
      return_url: `${baseUrl}/control-panel/settings?tab=billing&stripe=complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[stripe/connect] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Stripe Connect" },
      { status: 500 }
    );
  }
}
