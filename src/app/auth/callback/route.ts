import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { TRIAL_DAYS_WITHOUT_CARD } from "@/lib/plans/constants";
import { stripe } from "@/lib/stripe/client";

// Service role client — bypasses RLS for tenant + membership creation
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_MAP: Record<string, string | undefined> = {
  agency: process.env.STRIPE_PRICE_AGENCY,
  scale: process.env.STRIPE_PRICE_SCALE,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/control-panel/connections";
  const trialParam = searchParams.get("trial") ?? "7";
  const planParam = searchParams.get("plan") ?? "agency";
  const plan = planParam === "scale" ? "scale" : "agency";
  const intent = searchParams.get("intent") ?? "signin";

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
        .select("deleted_at, plan_status, has_card_on_file, stripe_customer_id, has_ever_paid, trial_ends_at")
        .eq("id", memberships[0].tenant_id)
        .single();

      if (tenant?.deleted_at) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=workspace_deleted", request.url)
        );
      }

      // Existing user who hasn't paid yet (e.g. retrying Google OAuth signup
      // after bailing on Stripe) — send them to billing, not an error page
      if (
        tenant?.plan_status === "trialing" &&
        !tenant?.trial_ends_at &&
        !tenant?.has_card_on_file &&
        !tenant?.has_ever_paid
      ) {
        // Try to create Stripe checkout session directly
        const stripeUrl = await createStripeCheckout(
          user,
          memberships[0].tenant_id,
          tenant?.stripe_customer_id ?? null,
          plan,
          request
        );
        if (stripeUrl) {
          return NextResponse.redirect(new URL(stripeUrl));
        }
        // Fallback to billing page
        return NextResponse.redirect(
          new URL(`/control-panel/settings?tab=billing&intent=subscribe&plan=${plan}`, request.url)
        );
      }
    }

    if (isNewUser && intent !== "signup") {
      // No membership and not signing up — orphan user. Reject.
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=not_registered", request.url)
      );
    }

    if (isNewUser && intent === "signup") {
      const workspaceName = user.email
        ? `${user.email.split("@")[0]}'s Workspace`
        : "My Workspace";

      // Scale plan → always pay-now, never gets a free trial
      const trialDays =
        trialParam === "0" || plan === "scale" ? 0 : TRIAL_DAYS_WITHOUT_CARD;

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

        // Pay-now flow: create Stripe checkout and redirect directly
        if (trialDays === 0) {
          const stripeUrl = await createStripeCheckout(
            user,
            tenant.id,
            null,
            plan,
            request
          );
          if (stripeUrl) {
            return NextResponse.redirect(new URL(stripeUrl));
          }
          // Fallback: redirect to billing page if Stripe call fails
          return NextResponse.redirect(
            new URL(`/control-panel/settings?tab=billing&intent=subscribe&plan=${plan}`, request.url)
          );
        }
      }
    }
  }

  // Free trial users or existing active users: go to the app
  return NextResponse.redirect(new URL(next, request.url));
}

/**
 * Creates a Stripe Checkout session and returns the checkout URL.
 * Used for pay-now Google OAuth signups to skip the billing page hop.
 */
async function createStripeCheckout(
  user: { id: string; email?: string },
  tenantId: string,
  existingCustomerId: string | null,
  plan: string,
  request: Request
): Promise<string | null> {
  try {
    const priceId = PRICE_MAP[plan];
    if (!priceId) return null;

    // Create or reuse Stripe Customer
    let customerId = existingCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { tenant_id: tenantId },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenantId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/control-panel/settings?tab=billing&billing=success`,
      cancel_url: `${baseUrl}/control-panel/settings?tab=billing&billing=cancelled`,
      metadata: { tenant_id: tenantId, plan },
      subscription_data: { metadata: { tenant_id: tenantId, plan } },
    });

    return session.url ?? null;
  } catch (err) {
    console.error("[auth/callback] Stripe checkout creation failed:", err);
    return null;
  }
}
