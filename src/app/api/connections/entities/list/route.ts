

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("sourceId") || "";
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  const { data, error } = await supabase
    .from("source_entities")
    .select("id,source_id,entity_kind,external_id,display_name,enabled_for_analytics,enabled_for_actions,last_seen_at,created_at")
    .eq("tenant_id", membership.tenant_id)
    .eq("source_id", sourceId)
    .order("display_name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entities: data ?? [] });
}


