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
    .select("plan, plan_status, trial_ends_at, has_card_on_file")
    .eq("id", membership.tenant_id)
    .single();

  const plan = tenant?.plan ?? "agency";
  const limits = getPlanLimits(plan);

  const { count: portalCount } = await supabase
    .from("client_portals")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id)
    .neq("status", "archived");

  const { count: memberCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id)
    .eq("invite_status", "active");

  const { count: clientCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id)
    .neq("status", "archived");

  return NextResponse.json({
    ok: true,
    plan,
    plan_status: tenant?.plan_status ?? "trialing",
    trial_ends_at: tenant?.trial_ends_at ?? null,
    has_card_on_file: tenant?.has_card_on_file ?? false,
    usage: {
      portals: { current: portalCount ?? 0, limit: limits.portal_limit },
      members: { current: memberCount ?? 0, limit: limits.team_limit },
      clients: { current: clientCount ?? 0 },
    },
    platform_fee_percent: limits.platform_fee_percent,
  });
});