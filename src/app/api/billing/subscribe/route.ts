import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { TRIAL_DAYS_WITH_CARD } from "@/lib/plans/constants";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_MAP: Record<string, string | undefined> = {
  agency: process.env.STRIPE_PRICE_AGENCY,
  scale: process.env.STRIPE_PRICE_SCALE,
};

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  // ── Rate limit: 5 subscribe attempts per IP per minute ──
  const { checkRateLimit, getClientIp } = await import('@/lib/api/rateLimit');
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`billing-subscribe:${ip}`, 60, 5);
  if (!limit.allowed) {
    return json(429, {
      error: 'Too many attempts. Please wait a moment and try again.',
      retryAfterMs: limit.reset_ms,
    });
  }

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

    // 2. Resolve tenant (admin only)
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!membership) {
      return json(403, { error: "Only admins can manage subscriptions" });
    }

    const tenantId = membership.tenant_id;

    // 3. Parse body
    const body = await request.json();
    const plan = (body.plan as string) ?? "agency";

    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return json(400, {
        error: `No Stripe price configured for plan "${plan}". Set STRIPE_PRICE_${plan.toUpperCase()} env var.`,
      });
    }

    // 4. Load tenant
    const { data: tenant, error: tenErr } = await supabaseAdmin
      .from("tenants")
      .select(
        "id, plan, plan_status, trial_ends_at, has_card_on_file, stripe_customer_id, stripe_subscription_id, name"
      )
      .eq("id", tenantId)
      .single();

    if (tenErr || !tenant) {
      return json(404, { error: "Tenant not found" });
    }

    // 5. If already has an active subscription, redirect to portal instead
    if (
      tenant.stripe_subscription_id &&
      tenant.plan_status === "active"
    ) {
      return json(400, {
        error: "Already subscribed. Use the billing portal to manage your subscription.",
        code: "ALREADY_SUBSCRIBED",
      });
    }

    // 6. Create or retrieve Stripe Customer on platform account
    let customerId = tenant.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: tenant.name || undefined,
        metadata: { tenant_id: tenantId },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenantId);
    }

    // 7. Determine trial days
    // skipTrial=true → pay-now flow, charge immediately, no trial period injected
    // Scale plan → never gets a trial (pay upfront only)
    // otherwise → 14-day trial if still within trialing window
    const skipTrial = body.skipTrial === true;

    const isCurrentlyTrialing =
      !skipTrial &&
      plan !== "scale" &&
      tenant.plan_status === "trialing" &&
      (!tenant.trial_ends_at || new Date(tenant.trial_ends_at) > new Date());

    const trialDays = isCurrentlyTrialing ? TRIAL_DAYS_WITH_CARD : undefined;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // 8. Create Checkout Session
    const sessionParams: Record<string, unknown> = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/control-panel/settings?tab=billing&billing=success`,
      cancel_url: `${baseUrl}/control-panel/settings?tab=billing&billing=cancelled`,
      metadata: {
        tenant_id: tenantId,
        plan,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan,
        },
      },
    };

    // Add trial if applicable
    if (trialDays) {
      (sessionParams.subscription_data as Record<string, unknown>).trial_period_days = trialDays;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return json(200, { url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[billing/subscribe] Error:", error);
    const message = error instanceof Error ? error.message : "Subscription failed";
    return json(500, { error: message });
  }
}
