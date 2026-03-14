import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json(401, { error: "Unauthorized" });
    }

    // 2. Resolve tenant
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return json(403, { error: "No tenant membership" });
    }

    // 3. Load tenant's Stripe customer
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", membership.tenant_id)
      .single();

    if (!tenant?.stripe_customer_id) {
      return json(400, {
        error: "No billing account found. Subscribe first.",
        code: "NO_CUSTOMER",
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // 4. Create Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${baseUrl}/control-panel/settings?tab=billing`,
    });

    return json(200, { url: portalSession.url });
  } catch (error) {
    console.error("[billing/portal] Error:", error);
    const message = error instanceof Error ? error.message : "Portal session failed";
    return json(500, { error: message });
  }
}
