import { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * V2 Thin Event Webhook — Connected Account Events
 *
 * Stripe's new Dashboard forces V2 thin events for "Connected accounts"
 * event destinations. Unlike V1 snapshot events, thin events only contain
 * metadata (event type + related object ID). We must call the API to get
 * the full object.
 *
 * This webhook handles:
 *   - v2.core.account.updated → sync connected account status to tenants table
 *
 * The existing V1 webhook at /api/stripe/webhooks handles platform events:
 *   - checkout.session.completed
 *   - customer.subscription.updated / deleted
 *   - invoice.paid / invoice.payment_failed
 */
export async function POST(request: NextRequest) {
  let thinEvent: Stripe.ThinEvent;

  // 1. Parse + verify the thin event using the V2 webhook secret
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[stripe/webhooks/v2] STRIPE_CONNECT_WEBHOOK_SECRET not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // parseThinEvent verifies the signature and returns { id, type, related_object }
    // In stripe-node v18, parseThinEvent is on the Stripe instance
    thinEvent = stripe.parseThinEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhooks/v2] Signature verification failed:", message);
    return new Response(`Webhook verification failed: ${message}`, { status: 400 });
  }

  // 2. Idempotency guard
  const eventId = thinEvent.id;
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (existing) {
    return new Response("Already processed", { status: 200 });
  }

  // 3. Route by event type
  let resolvedTenantId: string | null = null;

  try {
    switch (thinEvent.type) {
      case "v2.core.account.updated": {
        // Thin event only gives us the account ID — fetch the full account
        const accountId = thinEvent.related_object?.id;
        if (!accountId) {
          console.warn("[stripe/webhooks/v2] v2.core.account.updated missing related_object.id");
          break;
        }

        // Look up which tenant owns this connected account
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id, stripe_connected_at")
          .eq("stripe_account_id", accountId)
          .maybeSingle();

        if (!tenant) {
          console.warn(`[stripe/webhooks/v2] account.updated for unknown account: ${accountId}`);
          break;
        }

        resolvedTenantId = tenant.id;

        // Fetch the full account object from Stripe (thin events don't include it)
        const account = await stripe.accounts.retrieve(accountId);

        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const onboardingComplete =
          (account.charges_enabled && account.details_submitted) ?? false;

        const { error: updateErr } = await supabaseAdmin
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

        if (updateErr) {
          console.error("[stripe/webhooks/v2] Failed to update tenant:", updateErr);
          throw updateErr;
        }

        console.log(
          `[stripe/webhooks/v2] v2.core.account.updated → tenant ${tenant.id}: charges_enabled=${chargesEnabled}, payouts_enabled=${payoutsEnabled}`
        );
        break;
      }

      default: {
        console.log(`[stripe/webhooks/v2] Unhandled thin event type: ${thinEvent.type}`);
      }
    }

    // 4. Mark event as processed
    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: eventId,
      type: thinEvent.type,
      tenant_id: resolvedTenantId,
      processed: true,
      payload: { related_object_id: thinEvent.related_object?.id ?? null },
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: eventId,
      type: thinEvent.type,
      tenant_id: resolvedTenantId,
      processed: false,
      error_message: errorMessage,
      payload: { related_object_id: thinEvent.related_object?.id ?? null },
      received_at: new Date().toISOString(),
    });

    console.error("[stripe/webhooks/v2] Handler error:", errorMessage);
    return new Response("Webhook handler error", { status: 500 });
  }
}
