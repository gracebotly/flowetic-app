import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offeringId, customerEmail, returnUrl } = body;

    if (!offeringId || !customerEmail) {
      return json(400, { error: "portalId and customerEmail are required" });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: offering } = await supabaseAdmin
      .from("client_portals")
      .select("id, tenant_id")
      .eq("id", offeringId)
      .single();

    if (!offering) return json(404, { error: "Portal not found" });

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", offering.tenant_id)
      .single();

    if (!tenant?.stripe_account_id || !tenant.stripe_charges_enabled) {
      return json(400, { error: "Stripe not connected for this agency" });
    }

    const { data: customer } = await supabaseAdmin
      .from("portal_customers")
      .select("stripe_customer_id")
      .eq("portal_id", offeringId)
      .eq("email", customerEmail)
      .single();

    if (!customer?.stripe_customer_id) {
      return json(404, { error: "No Stripe customer found for this email" });
    }

    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: customer.stripe_customer_id,
        return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/products`,
      },
      { stripeAccount: tenant.stripe_account_id }
    );

    return json(200, { url: portalSession.url });
  } catch (error) {
    console.error("[stripe/portal] Error:", error);
    const message = error instanceof Error ? error.message : "Portal session failed";
    return json(500, { error: message });
  }
}
