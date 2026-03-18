import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offeringId } = await params;

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
    const days = parseInt(period) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: offering } = await supabaseAdmin
      .from("client_portals")
      .select("id, name, pricing_type, price_cents, status")
      .eq("id", offeringId)
      .eq("tenant_id", tenantId)
      .single();

    if (!offering) return json(404, { error: "Portal not found" });

    const { data: customers } = await supabaseAdmin
      .from("portal_customers")
      .select(
        "id, email, name, subscription_status, total_revenue_cents, total_runs, last_run_at, last_payment_at, created_at"
      )
      .eq("portal_id", offeringId)
      .eq("tenant_id", tenantId);

    const { data: executions } = await supabaseAdmin
      .from("workflow_executions")
      .select("id, customer_id, status, started_at")
      .eq("portal_id", offeringId)
      .eq("tenant_id", tenantId)
      .gte("started_at", since);

    const customerList = customers || [];
    const executionList = executions || [];

    const totalRevenueCents = customerList.reduce((s, c) => s + (c.total_revenue_cents || 0), 0);
    const totalCustomers = customerList.length;
    const activeCustomers = customerList.filter((c) => c.subscription_status === "active").length;
    const cancelledCustomers = customerList.filter((c) => c.subscription_status === "cancelled").length;
    const totalExecutions = executionList.length;
    const avgExecutionsPerCustomer = totalCustomers > 0 ? totalExecutions / totalCustomers : 0;
    const churnRate = activeCustomers + cancelledCustomers > 0 ? cancelledCustomers / (activeCustomers + cancelledCustomers) : 0;

    const dayExecMap = new Map<string, { count: number; revenue_cents: number }>();
    for (const e of executionList) {
      const day = e.started_at?.slice(0, 10);
      if (!day) continue;
      const existing = dayExecMap.get(day) || { count: 0, revenue_cents: 0 };
      existing.count += 1;
      dayExecMap.set(day, existing);
    }
    const dailyExecutions = Array.from(dayExecMap.entries())
      .map(([date, data]) => ({ date, count: data.count, revenue_cents: data.revenue_cents }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topCustomers = customerList
      .map((c) => ({
        email: c.email,
        name: c.name,
        subscription_status: c.subscription_status,
        revenue_cents: c.total_revenue_cents || 0,
        execution_count: c.total_runs || 0,
        last_run_at: c.last_run_at,
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents)
      .slice(0, 20);

    return json(200, {
      offering: {
        id: offering.id,
        name: offering.name,
        pricing_type: offering.pricing_type,
        price_cents: offering.price_cents,
        status: offering.status,
      },
      metrics: {
        total_revenue_cents: totalRevenueCents,
        total_customers: totalCustomers,
        active_customers: activeCustomers,
        total_executions: totalExecutions,
        avg_executions_per_customer: Math.round(avgExecutionsPerCustomer * 10) / 10,
        churn_rate: Math.round(churnRate * 1000) / 1000,
      },
      daily_executions: dailyExecutions,
      top_customers: topCustomers,
    });
  } catch (error) {
    console.error("[offerings/analytics] Error:", error);
    return json(500, { error: "Failed to load offering analytics" });
  }
}
