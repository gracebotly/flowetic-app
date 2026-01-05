

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { sourceId, entities } = body;

  if (!sourceId) {
    return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });
  }

  // Verify source belongs to tenant
  const { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) {
    return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  }

  // First, disable all entities for this source
  await supabase
    .from("source_entities")
    .update({ enabled_for_analytics: false })
    .eq("source_id", sourceId);

  // Then enable only the selected ones
  if (Array.isArray(entities) && entities.length > 0) {
    const externalIds = entities.map((e: any) => e.externalId).filter(Boolean);
    
    if (externalIds.length > 0) {
      await supabase
        .from("source_entities")
        .update({ enabled_for_analytics: true })
        .eq("source_id", sourceId)
        .in("external_id", externalIds);
    }
  }

  return NextResponse.json({ ok: true });
}


