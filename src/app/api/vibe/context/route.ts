




import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const { data: sources, error: sErr } = await supabase
    .from("sources")
    .select("id,type,name,status,created_at")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  if (sErr) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: sErr.message }, { status: 500 });

  const sourceIds = (sources ?? []).map((s) => s.id);

  const { data: entities } = await supabase
    .from("source_entities")
    .select("source_id,entity_kind,external_id,display_name,enabled_for_analytics,enabled_for_actions,last_seen_at")
    .in("source_id", sourceIds);

  return NextResponse.json({
    ok: true,
    snapshot: {
      tenantId: membership.tenant_id,
      userId: user.id,
      connections: (sources ?? []).map((s) => ({
        sourceId: s.id,
        platformType: s.type,
        name: s.name,
        status: s.status,
        category: ["vapi", "retell"].includes(String(s.type)) ? "voice_ai" : "automations",
        entities: (entities ?? [])
          .filter((e) => e.source_id === s.id)
          .map((e) => ({
            entityKind: e.entity_kind,
            externalId: e.external_id,
            displayName: e.display_name,
            enabledForAnalytics: e.enabled_for_analytics,
            enabledForActions: e.enabled_for_actions,
            lastSeenAt: e.last_seen_at,
          })),
      })),
      defaults: {
        dashboardScope: "aggregate_all",
      },
    },
  });
}





