// ============================================================================
// Phase 5C: Stripe Billing Meter Provisioning
//
// Creates a Billing Meter + metered Price on the connected account
// when a usage_based offering is published.
// ============================================================================

import { stripe } from "@/lib/stripe/client";

interface OfferingForMeter {
  id: string;
  name: string;
  price_cents: number;
  stripe_product_id: string;
}

interface MeterProvisionResult {
  stripe_meter_id: string;
  stripe_meter_event_name: string;
  stripe_price_id: string;
}

/**
 * Provisions a Stripe Billing Meter and a metered Price
 * on the agency's connected account.
 *
 * Called from syncOfferingToStripe() when pricing_type === 'usage_based'.
 *
 * Stripe Billing Meters (2025 model):
 * - Meter: defines aggregation (sum of events per billing period)
 * - Meter Event: individual usage report ({ stripe_customer_id, value: 1 })
 * - Metered Price: linked to meter, billed per unit at end of period
 */
export async function provisionMeter(
  offering: OfferingForMeter,
  stripeAccountId: string
): Promise<MeterProvisionResult> {
  // Derive a stable, unique event name from the offering ID
  const meterEventName = `gf_offering_${offering.id.replace(/-/g, "_")}`;

  // 1. Create Billing Meter on connected account
  const meter = await stripe.billing.meters.create(
    {
      display_name: `${offering.name} Executions`,
      event_name: meterEventName,
      default_aggregation: { formula: "sum" },
    },
    { stripeAccount: stripeAccountId }
  );

  // 2. Create metered Price linked to the meter
  const price = await stripe.prices.create(
    {
      product: offering.stripe_product_id,
      currency: "usd",
      unit_amount: offering.price_cents, // e.g. 50 = $0.50 per execution
      recurring: {
        interval: "month",
        usage_type: "metered",
        meter: meter.id,
      },
    },
    { stripeAccount: stripeAccountId }
  );

  console.log(
    `[meterSetup] Provisioned meter ${meter.id} + price ${price.id} for offering ${offering.id}`
  );

  return {
    stripe_meter_id: meter.id,
    stripe_meter_event_name: meterEventName,
    stripe_price_id: price.id,
  };
}
