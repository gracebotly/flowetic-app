import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_REASONS = [
  "too_expensive",
  "missing_features",
  "not_using_enough",
  "switching_competitor",
  "temporary_pause",
  "other",
];

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json(401, { error: "Unauthorized" });
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!membership) {
      return json(403, { error: "Only admins can cancel subscriptions" });
    }

    const tenantId = membership.tenant_id;
    const body = await request.json();
    const reason = body.reason as string;
    const details = (body.details as string) || null;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return json(400, { error: "Invalid cancellation reason" });
    }

    const { data: tenant, error: tenErr } = await supabaseAdmin
      .from("tenants")
      .select("id, plan, stripe_subscription_id")
      .eq("id", tenantId)
      .single();

    if (tenErr || !tenant) {
      return json(404, { error: "Tenant not found" });
    }

    if (!tenant.stripe_subscription_id) {
      return json(400, { error: "No active subscription to cancel" });
    }

    // Save cancellation reason
    await supabaseAdmin.from("cancellation_reasons").insert({
      tenant_id: tenantId,
      reason,
      details,
      plan_at_cancellation: tenant.plan,
      stripe_subscription_id: tenant.stripe_subscription_id,
    });

    // Cancel subscription in Stripe immediately
    await stripe.subscriptions.cancel(tenant.stripe_subscription_id);

    // Update tenant — plan_updated_at is the 30-day countdown start
    await supabaseAdmin
      .from("tenants")
      .update({
        plan_status: "cancelled",
        stripe_subscription_id: null,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    console.log(
      `[billing/cancel] Cancelled for tenant ${tenantId}, reason: ${reason}`
    );

    return json(200, { ok: true, cancelled: true });
  } catch (error) {
    console.error("[billing/cancel] Error:", error);
    const message =
      error instanceof Error ? error.message : "Cancellation failed";
    return json(500, { error: message });
  }
}
