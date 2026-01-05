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

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  // Only return entities that are enabled for analytics
  const { data, error } = await supabase
    .from("source_entities")
    .select(`
      id,
      source_id,
      entity_kind,
      external_id,
      display_name,
      enabled_for_analytics,
      enabled_for_actions,
      created_at,
      updated_at,
      sources!inner(
        tenant_id,
        type,
        name
      )
    `)
    .eq("sources.tenant_id", membership.tenant_id)
    .eq("enabled_for_analytics", true)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });
  }

  const entities = (data ?? []).map((entity: any) => ({
    id: entity.id,
    sourceId: entity.source_id,
    entityKind: entity.entity_kind,
    externalId: entity.external_id,
    name: entity.display_name,
    platform: entity.sources.type,
    platformName: entity.sources.name,
    enabledForAnalytics: entity.enabled_for_analytics,
    enabledForActions: entity.enabled_for_actions,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
    createdAtTs: Date.parse(entity.created_at),
    lastUpdatedTs: Date.parse(entity.updated_at)
  }));

  return NextResponse.json({ ok: true, entities });
}


