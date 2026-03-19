import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  // ── Rate limit: 5 resubscribe attempts per IP per minute ──
  const { checkRateLimit, getClientIp } = await import('@/lib/api/rateLimit');
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`billing-resubscribe:${ip}`, 60, 5);
  if (!limit.allowed) {
    return json(429, {
      error: 'Too many attempts. Please wait a moment and try again.',
      retryAfterMs: limit.reset_ms,
    });
  }

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
      return json(403, { error: "Only admins can resubscribe" });
    }

    const tenantId = membership.tenant_id;

    const { data: tenant, error: tenErr } = await supabaseAdmin
      .from("tenants")
      .select("id, stripe_subscription_id, plan_status")
      .eq("id", tenantId)
      .single();

    if (tenErr || !tenant) {
      return json(404, { error: "Tenant not found" });
    }

    if (tenant.plan_status !== "cancelling" || !tenant.stripe_subscription_id) {
      return json(400, { error: "No pending cancellation to undo" });
    }

    // Undo the cancel_at_period_end
    await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await supabaseAdmin
      .from("tenants")
      .update({
        plan_status: "active",
        cancel_at: null,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    console.log(`[billing/resubscribe] Reactivated tenant ${tenantId}`);

    return json(200, { ok: true });
  } catch (error) {
    console.error("[billing/resubscribe] Error:", error);
    const message =
      error instanceof Error ? error.message : "Resubscribe failed";
    return json(500, { error: message });
  }
}
