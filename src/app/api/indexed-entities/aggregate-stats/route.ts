import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.tenant_id) return NextResponse.json({ ok: false }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const externalIds = searchParams.get("external_ids")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const sourceId = searchParams.get("source_id");

  if (externalIds.length === 0) return NextResponse.json({ ok: true, entities: [] });

  let query = supabase
    .from("source_entities")
    .select("external_id, display_name, aggregate_stats")
    .eq("tenant_id", membership.tenant_id)
    .in("external_id", externalIds);

  if (sourceId) {
    query = query.eq("source_id", sourceId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entities: data ?? [] });
});