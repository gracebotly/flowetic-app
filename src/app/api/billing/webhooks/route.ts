import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { TRIAL_DAYS_WITH_CARD } from "@/lib/plans/constants";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  let event: Stripe.Event;

  // 1. Verify webhook signature
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[billing/webhooks] STRIPE_BILLING_WEBHOOK_SECRET not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[billing/webhooks] Signature verification failed:", message);
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  // 2. Idempotency guard
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return new Response("Already processed", { status: 200 });
  }

  let resolvedTenantId: string | null = null;

  try {
    switch (event.type) {
      // ── Checkout completed — subscription created ──────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const plan = session.metadata?.plan ?? "agency";

        if (!tenantId || session.mode !== "subscription") break;

        resolvedTenantId = tenantId;

        const subscriptionId = session.subscription as string;

        // Update tenant with subscription info
        await supabaseAdmin
          .from("tenants")
          .update({
            plan,
            plan_status: "active",
            has_card_on_file: true,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer as string,
            trial_ends_at: new Date(
              Date.now() + TRIAL_DAYS_WITH_CARD * 24 * 60 * 60 * 1000
            ).toISOString(),
            plan_updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);

        console.log(
          `[billing/webhooks] checkout.session.completed → tenant ${tenantId}, plan=${plan}`
        );
        break;
      }

      // ── Subscription updated (trial → active, plan change) ──
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;
        if (!tenantId) break;

        resolvedTenantId = tenantId;

        const statusMap: Record<string, string> = {
          active: "active",
          past_due: "past_due",
          unpaid: "past_due",
          canceled: "cancelled",
          incomplete: "trialing",
          incomplete_expired: "expired",
          trialing: "trialing",
          paused: "past_due",
        };

        let planStatus = statusMap[subscription.status] ?? "trialing";

        // If subscription is scheduled to cancel (works for both active AND trialing)
        if (subscription.cancel_at_period_end) {
          planStatus = "cancelling";
        }

        const updateData: Record<string, unknown> = {
          plan_status: planStatus,
          plan_updated_at: new Date().toISOString(),
        };

        // Track cancel_at date
        if (subscription.cancel_at_period_end && subscription.cancel_at) {
          updateData.cancel_at = new Date(subscription.cancel_at * 1000).toISOString();
        } else {
          updateData.cancel_at = null;
        }

        // If subscription becomes active (trial ended, payment succeeded)
        if (subscription.status === "active") {
          updateData.has_card_on_file = true;
        }

        // If there's a trial end, update trial_ends_at
        if (subscription.trial_end) {
          updateData.trial_ends_at = new Date(
            subscription.trial_end * 1000
          ).toISOString();
        }

        await supabaseAdmin
          .from("tenants")
          .update(updateData)
          .eq("id", tenantId);

        console.log(
          `[billing/webhooks] subscription.updated → tenant ${tenantId}, status=${subscription.status}`
        );
        break;
      }

      // ── Subscription deleted (cancelled) ───────────────────
      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;
        const tenantId = deletedSub.metadata?.tenant_id;
        if (!tenantId) break;

        resolvedTenantId = tenantId;

        await supabaseAdmin
          .from("tenants")
          .update({
            plan_status: "cancelled",
            stripe_subscription_id: null,
            plan_updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);

        console.log(
          `[billing/webhooks] subscription.deleted → tenant ${tenantId}`
        );
        break;
      }

      // ── Invoice payment failed ─────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        // Resolve tenant by stripe_customer_id
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!tenant) break;

        resolvedTenantId = tenant.id;

        await supabaseAdmin
          .from("tenants")
          .update({
            plan_status: "past_due",
            plan_updated_at: new Date().toISOString(),
          })
          .eq("id", tenant.id);

        console.log(
          `[billing/webhooks] invoice.payment_failed → tenant ${tenant.id}`
        );
        break;
      }

      // ── Invoice paid (renewal success) ─────────────────────
      case "invoice.paid": {
        const paidInvoice = event.data.object as Stripe.Invoice;
        const customerId = paidInvoice.customer as string;
        if (!customerId) break;

        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!tenant) break;

        resolvedTenantId = tenant.id;

        // Ensure plan is active on successful payment
        await supabaseAdmin
          .from("tenants")
          .update({
            plan_status: "active",
            has_card_on_file: true,
            has_ever_paid: true,
            plan_updated_at: new Date().toISOString(),
          })
          .eq("id", tenant.id);

        console.log(
          `[billing/webhooks] invoice.paid → tenant ${tenant.id}`
        );
        break;
      }

      default: {
        console.log(`[billing/webhooks] Unhandled event type: ${event.type}`);
      }
    }

    // Log event as processed
    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: event.id,
      type: event.type,
      tenant_id: resolvedTenantId,
      processed: true,
      payload: event.data.object as unknown as Record<string, unknown>,
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: event.id,
      type: event.type,
      tenant_id: resolvedTenantId,
      processed: false,
      error_message: errorMessage,
      payload: event.data.object as unknown as Record<string, unknown>,
      received_at: new Date().toISOString(),
    });

    console.error("[billing/webhooks] Handler error:", errorMessage);
    return new Response("Webhook handler error", { status: 500 });
  }
}
