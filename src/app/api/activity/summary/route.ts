import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return membership?.tenant_id ?? null;
}

/**
 * GET /api/activity/summary
 * Returns: active_clients, events_today, success_rate, revenue_today, sparkline (7-day)
 */
export const GET = withApiHandler(async function GET() {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Active clients (clients with status='active')
  const { count: activeClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .is("archived_at", null);

  // 2. Events today (activity_events created today)
  const { count: eventsToday } = await supabase
    .from("activity_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", todayStart);

  // 3. Success rate (last 7 days: success / total where status in success,error)
  const { data: statusCounts } = await supabase
    .from("activity_events")
    .select("status")
    .eq("tenant_id", tenantId)
    .gte("created_at", sevenDaysAgo)
    .in("status", ["success", "error"]);

  const total = (statusCounts ?? []).length;
  const successes = (statusCounts ?? []).filter(
    (e: { status: string }) => e.status === "success"
  ).length;
  const successRate = total > 0 ? Math.round((successes / total) * 1000) / 10 : 100;

  // 4. Revenue today — from billing events (placeholder: $0 until Stripe Connect)
  // When billing events start flowing, sum details->amount_cents
  const revenueToday = 0;

  // 5. Sparkline — event count per day for last 7 days
  const { data: sparklineRaw } = await supabase
    .from("activity_events")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true });

  const dayCounts: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dayCounts[key] = 0;
  }
  for (const row of sparklineRaw ?? []) {
    const key = (row.created_at as string).slice(0, 10);
    if (key in dayCounts) dayCounts[key]++;
  }
  const sparkline = Object.entries(dayCounts).map(([date, count]) => ({ date, count }));

  return json(200, {
    ok: true,
    active_clients: activeClients ?? 0,
    events_today: eventsToday ?? 0,
    success_rate: successRate,
    revenue_today: revenueToday,
    sparkline,
  });
});