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

  // 2. Idempotency guard — skip only if successfully processed
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, processed")
    .eq("id", event.id)
    .maybeSingle();

  if (existing?.processed) {
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

      // ── Phase 5B: Checkout & subscription events ──────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const offeringId = session.metadata?.portal_id ?? session.metadata?.offering_id;
        const customerEmail =
          session.metadata?.customer_email ??
          session.customer_details?.email;

        if (!offeringId || !customerEmail) break;

        // Resolve tenant from offering
        const { data: offeringData } = await supabaseAdmin
          .from("client_portals")
          .select("tenant_id, pricing_type")
          .eq("id", offeringId)
          .maybeSingle();

        if (!offeringData) break;
        resolvedTenantId = offeringData.tenant_id;

        // Update offering_customers with Stripe IDs
        const checkoutUpdate: Record<string, unknown> = {
          stripe_customer_id: session.customer as string,
        };

        if (session.mode === "subscription") {
          checkoutUpdate.subscription_status = "active";
          checkoutUpdate.stripe_subscription_id =
            session.subscription as string;
        }

        await supabaseAdmin
          .from("portal_customers")
          .update(checkoutUpdate)
          .eq("portal_id", offeringId)
          .eq("email", customerEmail);

        console.log(
          `[stripe/webhooks] checkout.session.completed → offering ${offeringId}, mode=${session.mode}`
        );

        // ── Send branded welcome email with dashboard link ──
        // Fire-and-forget: email failure must never break the webhook response.
        if (session.mode === "subscription") {
          try {
            const { sendWelcomeEmail } = await import(
              "@/lib/email/sendWelcomeEmail"
            );

            // Resolve portal token + tenant branding for the email
            const { data: portalForEmail } = await supabaseAdmin
              .from("client_portals")
              .select("name, token, slug, custom_path")
              .eq("id", offeringId)
              .maybeSingle();

            const { data: tenantForEmail } = await supabaseAdmin
              .from("tenants")
              .select("name, logo_url, primary_color, custom_domain, domain_verified")
              .eq("id", resolvedTenantId!)
              .maybeSingle();

            if (portalForEmail?.token && tenantForEmail) {
              const { getPortalBaseUrl } = await import("@/lib/domains/getPortalBaseUrl");
              const baseUrl = getPortalBaseUrl({
                custom_domain: tenantForEmail.custom_domain ?? null,
                domain_verified: tenantForEmail.domain_verified ?? false,
              });

              // Also look up customer name from portal_customers
              const { data: custRow } = await supabaseAdmin
                .from("portal_customers")
                .select("name")
                .eq("portal_id", offeringId)
                .eq("email", customerEmail)
                .maybeSingle();

              void sendWelcomeEmail({
                to: customerEmail,
                customerName: custRow?.name ?? null,
                portalName: portalForEmail.name,
                dashboardUrl: tenantForEmail.domain_verified && tenantForEmail.custom_domain && portalForEmail.custom_path
                  ? `${baseUrl}/${portalForEmail.custom_path}`
                  : `${baseUrl}/client/${portalForEmail.token}`,
                agencyName: tenantForEmail.name,
                agencyLogoUrl: tenantForEmail.logo_url,
                primaryColor: tenantForEmail.primary_color || "#374151",
              });
            }
          } catch (emailErr) {
            console.warn(
              "[stripe/webhooks] Welcome email setup failed (non-fatal):",
              emailErr
            );
          }
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subPortalId = subscription.metadata?.portal_id;
        if (!subPortalId) break;

        const statusMap: Record<string, string> = {
          active: "active",
          past_due: "paused",
          unpaid: "paused",
          canceled: "cancelled",
          incomplete: "paused",
          incomplete_expired: "expired",
          trialing: "active",
          paused: "paused",
        };

        await supabaseAdmin
          .from("portal_customers")
          .update({
            subscription_status:
              statusMap[subscription.status] ?? "paused",
            subscription_current_period_end: subscription.items.data[0]?.current_period_end
              ? new Date(
                  subscription.items.data[0].current_period_end * 1000
                ).toISOString()
              : null,
            stripe_subscription_item_id:
              subscription.items.data[0]?.id ?? null,
          })
          .eq("stripe_subscription_id", subscription.id);

        console.log(
          `[stripe/webhooks] subscription.updated → ${subscription.id}, status=${subscription.status}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;

        await supabaseAdmin
          .from("portal_customers")
          .update({ subscription_status: "cancelled" })
          .eq("stripe_subscription_id", deletedSub.id);

        console.log(
          `[stripe/webhooks] subscription.deleted → ${deletedSub.id}`
        );
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubId =
          invoice.parent?.type === "subscription_details"
            ? (invoice.parent.subscription_details?.subscription as string)
            : null;
        if (!invoiceSubId) break;

        // Use RPC for atomic revenue increment
        await supabaseAdmin.rpc("increment_revenue", {
          p_subscription_id: invoiceSubId,
          p_amount: invoice.amount_paid,
        });

        console.log(
          `[stripe/webhooks] invoice.paid → sub ${invoiceSubId}, amount=${invoice.amount_paid}`
        );
        break;
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedSubId =
          failedInvoice.parent?.type === "subscription_details"
            ? (failedInvoice.parent.subscription_details?.subscription as string)
            : null;
        if (!failedSubId) break;

        await supabaseAdmin
          .from("portal_customers")
          .update({ subscription_status: "paused" })
          .eq("stripe_subscription_id", failedSubId);

        console.log(
          `[stripe/webhooks] invoice.payment_failed → sub ${failedSubId}`
        );
        break;
      }

      default: {
        const eventType = event.type as string;
        if (eventType === "billing.meter.error_report_triggered") {
          console.error(
            `[stripe/webhooks] billing.meter.error_report_triggered:`,
            JSON.stringify(event.data.object, null, 2)
          );
        } else {
          console.log(`[stripe/webhooks] Unhandled event type: ${eventType}`);
        }
      }
    }

    // 5. Mark event as processed
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
    // Log failed processing
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await supabaseAdmin.from("stripe_webhook_events").upsert({
      id: event.id,
      type: event.type,
      tenant_id: resolvedTenantId,
      processed: false,
      error_message: errorMessage,
      payload: event.data.object as unknown as Record<string, unknown>,
      received_at: new Date().toISOString(),
    });

    console.error("[stripe/webhooks] Handler error:", errorMessage);
    return new Response("Webhook handler error", { status: 500 });
  }
}
