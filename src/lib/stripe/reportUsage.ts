// ============================================================================
// Phase 5C: Usage Event Reporting
//
// Called after a successful workflow execution for usage_based offerings.
// Reports a single meter event to Stripe Billing.
//
// Idempotency: The execution ID is passed as `identifier` — Stripe
// guarantees that duplicate events with the same identifier are ignored.
// This is critical for retry safety.
// ============================================================================

import { stripe } from "@/lib/stripe/client";

interface OfferingForUsage {
  id: string;
  pricing_type: string;
  stripe_meter_event_name: string | null;
}

/**
 * Reports a single usage event (1 execution) to the Stripe Billing Meter
 * on the agency's connected account.
 *
 * Safe to call multiple times — execution ID ensures idempotency.
 */
export async function reportUsageEvent(
  offering: OfferingForUsage,
  customerStripeId: string,
  stripeAccountId: string,
  executionId: string
): Promise<void> {
  if (offering.pricing_type !== "usage_based" || !offering.stripe_meter_event_name) {
    return; // Not a metered offering — no-op
  }

  try {
    await stripe.billing.meterEvents.create(
      {
        event_name: offering.stripe_meter_event_name,
        payload: {
          stripe_customer_id: customerStripeId,
          value: "1", // 1 execution
        },
        identifier: executionId, // Idempotency key — prevents double-reporting
        timestamp: Math.floor(Date.now() / 1000),
      },
      { stripeAccount: stripeAccountId }
    );

    console.log(
      `[reportUsage] Reported usage for offering ${offering.id}, execution ${executionId}`
    );
  } catch (error) {
    // Log but don't throw — usage reporting failure should not block the user
    console.error(
      `[reportUsage] Failed to report usage for execution ${executionId}:`,
      error
    );
  }
}
