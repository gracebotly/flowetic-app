import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

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
 * GET /api/activity/export
 * Same filters as /api/activity, returns CSV download.
 */
export const GET = withApiHandler(async function GET(req: Request) {
  const supabase = await createClient();
  const tenantId = await getTenantId(supabase);
  if (!tenantId) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const offeringId = searchParams.get("portal_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim() || null;

  let query = supabase
    .from("activity_events")
    .select("created_at, category, action, status, entity_type, entity_name, message, actor_type, details")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (offeringId) query = query.eq("portal_id", offeringId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (search) query = query.ilike("message", `%${search}%`);

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, code: "QUERY_FAILED" }, { status: 500 });
  }

  const rows = events ?? [];
  const headers = ["timestamp", "category", "action", "status", "entity_type", "entity_name", "message", "actor_type"];
  const csvLines = [
    headers.join(","),
    ...rows.map((e: Record<string, unknown>) =>
      [
        e.created_at,
        e.category,
        e.action,
        e.status,
        e.entity_type ?? "",
        `"${String(e.entity_name ?? "").replace(/"/g, '""')}"`,
        `"${String(e.message ?? "").replace(/"/g, '""')}"`,
        e.actor_type,
      ].join(",")
    ),
  ];

  return new NextResponse(csvLines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});