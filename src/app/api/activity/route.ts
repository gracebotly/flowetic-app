import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveColor, resolveIcon } from "@/lib/activity/eventTemplates";
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
 * GET /api/activity
 * Query params: category, status, client_id, portal_id, from, to, search, cursor, limit
 */
export const GET = withApiHandler(async function GET(req: Request) {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const offeringId = searchParams.get("portal_id");
  const from = searchParams.get("from"); // ISO datetime
  const to = searchParams.get("to"); // ISO datetime
  const search = searchParams.get("search")?.trim() || null;
  const cursor = searchParams.get("cursor"); // ISO datetime of last item
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 100);

  let query = supabase
    .from("activity_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (offeringId) query = query.eq("portal_id", offeringId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (search) query = query.ilike("message", `%${search}%`);
  if (cursor) query = query.lt("created_at", cursor);

  const { data: events, error } = await query;

  if (error) {
    console.error("[GET /api/activity] Query failed:", error);
    return json(500, { ok: false, code: "QUERY_FAILED", message: error.message });
  }

  const enriched = (events ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    _color: resolveColor(e.category as string, e.status as string),
    _icon: resolveIcon(e.category as string),
  }));

  return json(200, {
    ok: true,
    events: enriched,
    has_more: (events ?? []).length === limit,
  });
});