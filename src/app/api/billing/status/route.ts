import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanLimits } from "@/lib/plans/constants";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET() {
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "plan, plan_status, trial_ends_at, has_card_on_file, stripe_subscription_id, stripe_customer_id, cancel_at"
    )
    .eq("id", membership.tenant_id)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const limits = getPlanLimits(tenant.plan);
  const trialExpired =
    tenant.plan_status === "trialing" &&
    !!tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at) < new Date();

  return NextResponse.json({
    ok: true,
    plan: tenant.plan,
    plan_label: limits.label,
    plan_status: tenant.plan_status,
    trial_ends_at: tenant.trial_ends_at,
    has_card_on_file: tenant.has_card_on_file,
    trial_expired: trialExpired,
    has_subscription: !!tenant.stripe_subscription_id,
    price_cents: limits.price_cents,
    platform_fee_percent: limits.platform_fee_percent,
    cancel_at: tenant.cancel_at,
  });
});