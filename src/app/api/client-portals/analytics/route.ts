import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json(401, { error: "Unauthorized" });

    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return json(403, { error: "No tenant" });
    const tenantId = membership.tenant_id;

    const period = request.nextUrl.searchParams.get("period") || "30d";
    const beforeParam = request.nextUrl.searchParams.get("before");
    const days = parseInt(period) || 30;

    // If "before" is provided, compute a window ending at that date
    // (used by the frontend to fetch the previous period for % change)
    const anchorMs = beforeParam ? new Date(beforeParam).getTime() : Date.now();
    const since = new Date(anchorMs - days * 24 * 60 * 60 * 1000).toISOString();
    const until = beforeParam || null;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build customer query — if until is set, only include customers created before that date
    let customerQuery = supabaseAdmin
      .from("portal_customers")
      .select(
        "id, portal_id, email, subscription_status, total_revenue_cents, total_runs, last_payment_at, stripe_subscription_id"
      )
      .eq("tenant_id", tenantId);
    if (until) {
      customerQuery = customerQuery.lte("created_at", until);
    }
    const { data: customers } = await customerQuery;

    const { data: offerings } = await supabaseAdmin
      .from("client_portals")
      .select("id, name, pricing_type, price_cents, status, surface_type, view_count, published_at")
      .eq("tenant_id", tenantId);

    // Build execution query — filter by date window
    let executionQuery = supabaseAdmin
      .from("workflow_executions")
      .select("id, portal_id, status, started_at")
      .eq("tenant_id", tenantId)
      .gte("started_at", since);
    if (until) {
      executionQuery = executionQuery.lte("started_at", until);
    }
    const { data: executions } = await executionQuery;

    const customerList = customers || [];
    const offeringList = offerings || [];
    const executionList = executions || [];

    const totalRevenueCents = customerList.reduce((sum, c) => sum + (c.total_revenue_cents || 0), 0);
    const totalCustomers = customerList.length;
    const activeSubscriptions = customerList.filter((c) => c.subscription_status === "active").length;
    const totalExecutions = executionList.length;

    const offeringMap = new Map(offeringList.map((o) => [o.id, o]));
    let mrrCents = 0;
    for (const c of customerList) {
      if (c.subscription_status !== "active") continue;
      const offering = offeringMap.get(c.portal_id);
      if (offering && (offering.pricing_type === "monthly" || offering.pricing_type === "usage_based")) {
        mrrCents += offering.price_cents || 0;
      }
    }

    const perOffering = offeringList
      .map((o) => {
        const oCusts = customerList.filter((c) => c.portal_id === o.id);
        const oExecs = executionList.filter((e) => e.portal_id === o.id);
        const oRevenue = oCusts.reduce((sum, c) => sum + (c.total_revenue_cents || 0), 0);
        return {
          portal_id: o.id,
          portal_name: o.name,
          pricing_type: o.pricing_type,
          surface_type: o.surface_type || "analytics",
          view_count: o.view_count || 0,
          published_at: o.published_at || null,
          revenue_cents: oRevenue,
          customers: oCusts.length,
          executions: oExecs.length,
        };
      })
      .filter((o) => o.customers > 0 || o.executions > 0)
      .sort((a, b) => b.revenue_cents - a.revenue_cents);

    const dayMap = new Map<string, number>();
    for (const c of customerList) {
      if (!c.last_payment_at) continue;
      const day = c.last_payment_at.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + (c.total_revenue_cents || 0));
    }
    const revenueTimeline = Array.from(dayMap.entries())
      .map(([date, revenue_cents]) => ({ date, revenue_cents }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recentPayments = customerList
      .filter((c) => c.last_payment_at && c.last_payment_at >= since)
      .map((c) => {
        const offering = offeringMap.get(c.portal_id);
        return {
          customer_email: c.email,
          portal_name: offering?.name || "Unknown",
          amount_cents: c.total_revenue_cents || 0,
          paid_at: c.last_payment_at,
        };
      })
      .sort((a, b) => (b.paid_at || "").localeCompare(a.paid_at || ""))
      .slice(0, 10);

    return json(200, {
      overview: {
        total_revenue_cents: totalRevenueCents,
        total_customers: totalCustomers,
        active_subscriptions: activeSubscriptions,
        total_executions: totalExecutions,
        mrr_cents: mrrCents,
      },
      per_offering: perOffering,
      revenue_timeline: revenueTimeline,
      recent_payments: recentPayments,
    });
  } catch (error) {
    console.error("[offerings/analytics] Error:", error);
    return json(500, { error: "Failed to load analytics" });
  }
}
