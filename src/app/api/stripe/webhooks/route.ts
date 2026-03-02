import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = "nodejs";

// Use service role client — webhooks are NOT user-authenticated
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

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhooks] Signature verification failed:", message);
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  // 2. Idempotency guard — skip if already processed
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return new Response("Already processed", { status: 200 });
  }

  // 3. Log event (unprocessed)
  let resolvedTenantId: string | null = null;

  try {
    // 4. Route event to handler
    switch (event.type) {
      // ── Phase 5A: Connect account updates ──────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        // Resolve tenant by stripe_account_id
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id, stripe_connected_at")
          .eq("stripe_account_id", account.id)
          .maybeSingle();

        if (!tenant) {
          console.warn(
            `[stripe/webhooks] account.updated for unknown account: ${account.id}`
          );
          break;
        }

        resolvedTenantId = tenant.id;

        // Update tenant Stripe status flags
        const { error: updateErr } = await supabaseAdmin
          .from("tenants")
          .update({
            stripe_charges_enabled: account.charges_enabled ?? false,
            stripe_payouts_enabled: account.payouts_enabled ?? false,
            stripe_onboarding_complete:
              (account.charges_enabled && account.details_submitted) ?? false,
            stripe_connected_at:
              account.charges_enabled && !tenant.stripe_connected_at
                ? new Date().toISOString()
                : tenant.stripe_connected_at,
          })
          .eq("id", tenant.id);

        if (updateErr) {
          console.error("[stripe/webhooks] Failed to update tenant:", updateErr);
          throw updateErr;
        }

        console.log(
          `[stripe/webhooks] account.updated → tenant ${tenant.id}: charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`
        );
        break;
      }

      // ── Phase 5B events (added in Push 6) ──────────────
      // case "checkout.session.completed":
      // case "customer.subscription.updated":
      // case "customer.subscription.deleted":
      // case "invoice.paid":
      // case "invoice.payment_failed":

      default:
        console.log(`[stripe/webhooks] Unhandled event type: ${event.type}`);
    }

    // 5. Mark event as processed
    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: event.id,
      type: event.type,
      tenant_id: resolvedTenantId,
      processed: true,
      payload: event.data.object as Record<string, unknown>,
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    // Log failed processing
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: event.id,
      type: event.type,
      tenant_id: resolvedTenantId,
      processed: false,
      error_message: errorMessage,
      payload: event.data.object as Record<string, unknown>,
      received_at: new Date().toISOString(),
    });

    console.error("[stripe/webhooks] Handler error:", errorMessage);
    return new Response("Webhook handler error", { status: 500 });
  }
}
