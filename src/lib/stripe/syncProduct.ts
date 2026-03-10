import { stripe } from '@/lib/stripe/client';
import type Stripe from 'stripe';

interface OfferingForSync {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  pricing_type: string;
  price_cents: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

interface SyncResult {
  stripe_product_id: string;
  stripe_price_id: string | null;
  stripe_meter_id?: string;
  stripe_meter_event_name?: string;
}

/**
 * Syncs an offering to Stripe as a Product + Price on the connected account.
 * Called when an offering's status changes to 'active' and pricing_type !== 'free'.
 *
 * All Stripe calls use { stripeAccount } to create resources on the
 * agency's connected account — NOT the platform account.
 */
export async function syncOfferingToStripe(
  offering: OfferingForSync,
  tenantStripeAccountId: string
): Promise<SyncResult> {
  // 1. Create or update Stripe Product on connected account
  let stripeProductId = offering.stripe_product_id;

  if (stripeProductId) {
    // Update existing product
    await stripe.products.update(
      stripeProductId,
      {
        name: offering.name,
        description: offering.description ?? undefined,
        metadata: { portal_id: offering.id, tenant_id: offering.tenant_id },
      },
      { stripeAccount: tenantStripeAccountId }
    );
  } else {
    // Create new product
    const stripeProduct = await stripe.products.create(
      {
        name: offering.name,
        description: offering.description ?? undefined,
        metadata: { portal_id: offering.id, tenant_id: offering.tenant_id },
      },
      { stripeAccount: tenantStripeAccountId }
    );
    stripeProductId = stripeProduct.id;
  }

  if (!stripeProductId) {
    throw new Error('Failed to create or resolve Stripe product id');
  }

  // 2. Create Stripe Price based on pricing_type
  let stripePriceId: string | null = offering.stripe_price_id;

  // Only create a new price if one doesn't exist or price changed
  // (Stripe prices are immutable — create new, archive old)
  if (!stripePriceId) {
    let stripePrice: Stripe.Price;

    switch (offering.pricing_type) {
      case 'per_run':
        stripePrice = await stripe.prices.create(
          {
            product: stripeProductId,
            unit_amount: offering.price_cents,
            currency: 'usd',
          },
          { stripeAccount: tenantStripeAccountId }
        );
        stripePriceId = stripePrice.id;
        break;

      case 'monthly':
        stripePrice = await stripe.prices.create(
          {
            product: stripeProductId,
            unit_amount: offering.price_cents,
            currency: 'usd',
            recurring: { interval: 'month' },
          },
          { stripeAccount: tenantStripeAccountId }
        );
        stripePriceId = stripePrice.id;
        break;

      case 'usage_based': {
        // Phase 5C: Provision meter + metered price
        const { provisionMeter } = await import('@/lib/stripe/meterSetup');
        const meterResult = await provisionMeter(
          {
            id: offering.id,
            name: offering.name,
            price_cents: offering.price_cents,
            stripe_product_id: stripeProductId,
          },
          tenantStripeAccountId
        );
        stripePriceId = meterResult.stripe_price_id;

        // Return early — include meter fields in addition to standard fields
        return {
          stripe_product_id: stripeProductId,
          stripe_price_id: meterResult.stripe_price_id,
          stripe_meter_id: meterResult.stripe_meter_id,
          stripe_meter_event_name: meterResult.stripe_meter_event_name,
        };
      }

      case 'free':
        // No Stripe price needed
        break;
    }
  }

  return {
    stripe_product_id: stripeProductId,
    stripe_price_id: stripePriceId,
  };
}
