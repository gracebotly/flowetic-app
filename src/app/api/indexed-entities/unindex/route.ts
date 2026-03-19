import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

export const POST = withApiHandler(async function POST(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = (body.sourceId as string | undefined) ?? "";
  const externalId = (body.externalId as string | undefined) ?? "";

  if (!sourceId || !externalId) {
    return NextResponse.json({ ok: false, code: "MISSING_FIELDS" }, { status: 400 });
  }

  // Ensure source belongs to tenant
  const { data: source } = await supabase
    .from("sources")
    .select("id,tenant_id")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (!source) return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });

  // ── Resolve entity UUID from source_id + external_id ──
  const { data: entity } = await supabase
    .from("source_entities")
    .select("id")
    .eq("source_id", sourceId)
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle();

  if (!entity) {
    return NextResponse.json({ ok: false, code: "ENTITY_NOT_FOUND", message: "Entity not found." }, { status: 404 });
  }

  // ── Pre-flight: check if any active client portals reference this entity ──
  // Check 1: direct reference via client_portals.entity_id
  const { data: directPortals } = await supabase
    .from("client_portals")
    .select("id, name, status")
    .eq("tenant_id", membership.tenant_id)
    .eq("entity_id", entity.id)
    .neq("status", "archived");

  // Check 2: junction table reference via portal_entities.entity_id
  const { data: junctionRefs } = await supabase
    .from("portal_entities")
    .select("portal_id")
    .eq("entity_id", entity.id);

  // Resolve junction portal names (only non-archived)
  let junctionPortals: Array<{ id: string; name: string }> = [];
  if (junctionRefs && junctionRefs.length > 0) {
    const portalIds = [...new Set(junctionRefs.map((r) => r.portal_id))];
    const { data: portals } = await supabase
      .from("client_portals")
      .select("id, name, status")
      .in("id", portalIds)
      .neq("status", "archived");

    junctionPortals = (portals ?? []).map((p) => ({ id: p.id, name: p.name }));
  }

  // Merge and deduplicate blocking portals
  const allBlockingMap = new Map<string, string>();
  for (const p of directPortals ?? []) {
    allBlockingMap.set(p.id, p.name);
  }
  for (const p of junctionPortals) {
    allBlockingMap.set(p.id, p.name);
  }

  if (allBlockingMap.size > 0) {
    const portalNames = Array.from(allBlockingMap.values());
    const count = portalNames.length;
    const nameList = portalNames.length <= 3
      ? portalNames.map((n) => `"${n}"`).join(", ")
      : portalNames.slice(0, 3).map((n) => `"${n}"`).join(", ") + `, and ${portalNames.length - 3} more`;

    return NextResponse.json(
      {
        ok: false,
        code: "ENTITY_IN_USE",
        message: `This agent is used by ${count} client portal${count > 1 ? "s" : ""} (${nameList}). Remove it from ${count > 1 ? "those portals" : "that portal"} first, then try again.`,
        blockingPortals: portalNames,
      },
      { status: 409 },
    );
  }

  // ── Safe to un-index ──
  const { error } = await supabase
    .from("source_entities")
    .update({ enabled_for_analytics: false })
    .eq("source_id", sourceId)
    .eq("external_id", externalId);

  if (error) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
});