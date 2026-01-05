
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data: rows, error } = await supabase
    .from("source_entities")
    .select("external_id,display_name,entity_kind,enabled_for_analytics,enabled_for_actions,last_seen_at,created_at,updated_at")
    .eq("tenant_id", membership.tenant_id)
    .eq("source_id", sourceId)
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    entities: (rows ?? []).map((r: any) => ({
      externalId: String(r.external_id),
      displayName: String(r.display_name ?? ""),
      entityKind: String(r.entity_kind),
      enabledForAnalytics: Boolean(r.enabled_for_analytics),
      enabledForActions: Boolean(r.enabled_for_actions),
      lastSeenAt: r.last_seen_at ? String(r.last_seen_at) : null,
      createdAt: r.created_at ? String(r.created_at) : null,
      updatedAt: r.updated_at ? String(r.updated_at) : null,
    })),
  });
}
