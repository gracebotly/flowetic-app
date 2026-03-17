import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PaymentMethodResult = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

type InvoiceResult = {
  id: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
};

type DetailsResult = {
  ok: true;
  subscription: {
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    created: string | null;
    cancel_at_period_end: boolean;
    cancel_at: string | null;
    trial_end: string | null;
  } | null;
  payment_method: PaymentMethodResult | null;
  invoices: InvoiceResult[];
};

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("stripe_customer_id, stripe_subscription_id, plan, plan_status")
    .eq("id", membership.tenant_id)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const result: DetailsResult = {
    ok: true,
    subscription: null,
    payment_method: null,
    invoices: [],
  };

  if (!tenant.stripe_customer_id) {
    return NextResponse.json(result);
  }

  try {
    if (tenant.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id, {
        expand: ["default_payment_method"],
      }) as any;

      result.subscription = {
        status: sub.status,
        current_period_start: sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString()
          : null,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        created: sub.created ? new Date(sub.created * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end,
        cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      };

      if (sub.default_payment_method && typeof sub.default_payment_method === "object") {
        const pm = sub.default_payment_method;
        if ("card" in pm && pm.card) {
          result.payment_method = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          };
        }
      }
    }

    if (!result.payment_method) {
      const customer = await stripe.customers.retrieve(tenant.stripe_customer_id, {
        expand: ["invoice_settings.default_payment_method", "default_source"],
      });

      if (!("deleted" in customer && customer.deleted)) {
        const defaultPm = customer.invoice_settings?.default_payment_method;
        if (defaultPm && typeof defaultPm === "object" && "card" in defaultPm && defaultPm.card) {
          result.payment_method = {
            brand: defaultPm.card.brand,
            last4: defaultPm.card.last4,
            exp_month: defaultPm.card.exp_month,
            exp_year: defaultPm.card.exp_year,
          };
        } else {
          const src = customer.default_source;
          if (src && typeof src === "object" && "last4" in src && src.last4) {
            result.payment_method = {
              brand: ("brand" in src && typeof src.brand === "string" ? src.brand : "card"),
              last4: String(src.last4),
              exp_month: ("exp_month" in src && typeof src.exp_month === "number" ? src.exp_month : 0),
              exp_year: ("exp_year" in src && typeof src.exp_year === "number" ? src.exp_year : 0),
            };
          }
        }
      }
    }

    const invoices = await stripe.invoices.list({
      customer: tenant.stripe_customer_id,
      limit: 12,
    }) as any;

    result.invoices = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: new Date(inv.created * 1000).toISOString(),
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }));
  } catch (err) {
    console.error("[billing/details] Stripe error:", err);
  }

  return NextResponse.json(result);
}
