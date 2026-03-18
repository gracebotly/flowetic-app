import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  stripe,
  resolveApplicationFeePercent,
  calculateApplicationFee,
} from '@/lib/stripe/client';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      offeringId,
      customerEmail,
      customerName,
      dashboardToken: bodyDashboardToken,
    } = body as {
      offeringId?: string;
      customerEmail?: string;
      customerName?: string;
      dashboardToken?: string;
    };

    if (!offeringId || !customerEmail) {
      return json(400, { error: 'offeringId and customerEmail are required' });
    }

    // 1. Load offering
    const { data: offering, error: offErr } = await supabaseAdmin
      .from('client_portals')
      .select(
        'id, tenant_id, name, slug, pricing_type, price_cents, stripe_product_id, stripe_price_id, stripe_meter_event_name'
      )
      .eq('id', offeringId)
      .eq('status', 'active')
      .maybeSingle();

    if (offErr || !offering) {
      return json(404, { error: 'Portal not found or not active' });
    }

    if (offering.pricing_type === 'free') {
      return json(400, { error: 'Free portals do not require checkout' });
    }

    // 2. Load tenant + validate Stripe is connected
    const { data: tenant, error: tenErr } = await supabaseAdmin
      .from('tenants')
      .select(
        'id, plan, stripe_account_id, stripe_charges_enabled, stripe_application_fee_percent'
      )
      .eq('id', offering.tenant_id)
      .single();

    if (tenErr || !tenant || !tenant.stripe_account_id) {
      return json(400, { error: 'Agency has not connected Stripe' });
    }

    if (!tenant.stripe_charges_enabled) {
      return json(400, { error: 'Agency Stripe account cannot accept charges yet' });
    }

    // 3. Create or retrieve Stripe Customer on connected account
    const existingCustomers = await stripe.customers.list(
      { email: customerEmail, limit: 1 },
      { stripeAccount: tenant.stripe_account_id }
    );

    let stripeCustomerId: string;
    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create(
        {
          email: customerEmail,
          name: customerName || undefined,
          metadata: { offering_id: offering.id },
        },
        { stripeAccount: tenant.stripe_account_id }
      );
      stripeCustomerId = newCustomer.id;
    }

    // 4. Resolve application fee (null-safe: plan column may be absent on old tenants)
    const feePercent = resolveApplicationFeePercent(
      tenant.plan ?? "agency",
      tenant.stripe_application_fee_percent
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // Resolve dashboard token for analytics portals
    const dashboardToken = bodyDashboardToken || null;
    let resolvedToken = dashboardToken;
    if (!resolvedToken) {
      // Check if this is an analytics portal with a token
      const { data: tokenRow } = await supabaseAdmin
        .from('client_portals')
        .select('token')
        .eq('id', offeringId)
        .maybeSingle();
      resolvedToken = tokenRow?.token || null;
    }

    const successBase = resolvedToken
      ? `${baseUrl}/client/${resolvedToken}`
      : `${baseUrl}/products/${offering.slug}/run`;

    // 5. Create Checkout Session based on pricing_type
    let session;

    if (offering.pricing_type === 'per_run') {
      if (!offering.stripe_price_id) {
        return json(400, {
          error: 'Portal has not been synced to Stripe. Republish the portal.',
        });
      }

      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer: stripeCustomerId,
          line_items: [{ price: offering.stripe_price_id, quantity: 1 }],
          payment_intent_data: {
            application_fee_amount: calculateApplicationFee(
              offering.price_cents,
              feePercent
            ),
          },
          success_url: `${successBase}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/products/${offering.slug}?cancelled=true`,
          metadata: {
            portal_id: offering.id,
            customer_email: customerEmail,
          },
        },
        { stripeAccount: tenant.stripe_account_id }
      );
    } else if (offering.pricing_type === 'monthly') {
      if (!offering.stripe_price_id) {
        return json(400, {
          error: 'Portal has not been synced to Stripe. Republish the portal.',
        });
      }

      session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: stripeCustomerId,
          line_items: [{ price: offering.stripe_price_id, quantity: 1 }],
          subscription_data: {
            application_fee_percent: feePercent,
            metadata: { portal_id: offering.id },
          },
          success_url: `${successBase}?subscribed=true`,
          cancel_url: `${baseUrl}/products/${offering.slug}?cancelled=true`,
          metadata: {
            portal_id: offering.id,
            customer_email: customerEmail,
          },
        },
        { stripeAccount: tenant.stripe_account_id }
      );
    } else if (offering.pricing_type === 'usage_based') {
      // Phase 5C: Usage-based creates a metered subscription (no upfront charge)
      if (!offering.stripe_price_id) {
        return json(400, {
          error:
            'Usage-based offering is missing Stripe metered price. Re-publish the offering.',
        });
      }

      session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: stripeCustomerId,
          line_items: [{ price: offering.stripe_price_id }],
          subscription_data: {
            application_fee_percent: feePercent,
            metadata: { portal_id: offering.id },
          },
          success_url: `${successBase}?subscribed=true`,
          cancel_url: `${baseUrl}/products/${offering.slug}?cancelled=true`,
          metadata: {
            portal_id: offering.id,
            customer_email: customerEmail,
          },
        },
        { stripeAccount: tenant.stripe_account_id }
      );
    } else {
      return json(400, { error: `Unsupported pricing type: ${offering.pricing_type}` });
    }

    // 6. Upsert offering_customer record
    await supabaseAdmin.from('portal_customers').upsert(
      {
        portal_id: offering.id,
        tenant_id: offering.tenant_id,
        email: customerEmail,
        name: customerName || null,
        stripe_customer_id: stripeCustomerId,
      },
      { onConflict: 'portal_id,email' }
    );

    return json(200, { url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[stripe/checkout] Error:', error);
    const message = error instanceof Error ? error.message : 'Checkout failed';
    return json(500, { error: message });
  }
}
