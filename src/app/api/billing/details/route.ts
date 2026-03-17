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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Stripe SDK v18 with apiVersion "2025-08-27.basil" has type mismatches
  // on subscription/invoice properties. We cast to any at the boundary
  // and type-narrow manually for runtime safety.

  try {
    if (tenant.stripe_subscription_id) {
      const sub: any = await stripe.subscriptions.retrieve(
        tenant.stripe_subscription_id,
        { expand: ["default_payment_method"] }
      );

      result.subscription = {
        status: sub.status,
        current_period_start: sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString()
          : null,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        created: sub.created ? new Date(sub.created * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      };

      if (sub.default_payment_method && typeof sub.default_payment_method === "object") {
        const pm = sub.default_payment_method;
        if (pm.card) {
          result.payment_method = {
            brand: pm.card.brand ?? "card",
            last4: pm.card.last4 ?? "0000",
            exp_month: pm.card.exp_month ?? 0,
            exp_year: pm.card.exp_year ?? 0,
          };
        }
      }
    }

    if (!result.payment_method) {
      const customer: any = await stripe.customers.retrieve(
        tenant.stripe_customer_id,
        { expand: ["invoice_settings.default_payment_method", "default_source"] }
      );

      if (!customer.deleted) {
        const defaultPm = customer.invoice_settings?.default_payment_method;
        if (defaultPm && typeof defaultPm === "object" && defaultPm.card) {
          result.payment_method = {
            brand: defaultPm.card.brand ?? "card",
            last4: defaultPm.card.last4 ?? "0000",
            exp_month: defaultPm.card.exp_month ?? 0,
            exp_year: defaultPm.card.exp_year ?? 0,
          };
        } else {
          const src = customer.default_source;
          if (src && typeof src === "object" && src.last4) {
            result.payment_method = {
              brand: src.brand ?? "card",
              last4: String(src.last4),
              exp_month: src.exp_month ?? 0,
              exp_year: src.exp_year ?? 0,
            };
          }
        }
      }
    }

    const invoicesResponse: any = await stripe.invoices.list({
      customer: tenant.stripe_customer_id,
      limit: 12,
    });

    const invoiceData: any[] = invoicesResponse.data ?? [];

    result.invoices = invoiceData.map((inv: any) => ({
      id: inv.id ?? "",
      number: inv.number ?? null,
      amount_paid: inv.amount_paid ?? 0,
      currency: inv.currency ?? "usd",
      status: inv.status ?? null,
      created: new Date((inv.created ?? 0) * 1000).toISOString(),
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
      invoice_pdf: inv.invoice_pdf ?? null,
    }));
  } catch (err) {
    console.error("[billing/details] Stripe error:", err);
  }

  return NextResponse.json(result);
}
