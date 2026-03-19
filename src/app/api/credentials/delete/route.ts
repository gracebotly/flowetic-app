import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/logActivity";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

export const POST = withApiHandler(async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = String(body?.sourceId ?? "").trim();

  if (!sourceId) {
    return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID", message: "Source ID is required" }, { status: 400 });
  }

  const { data: source, error: sourceLookupErr } = await supabase
    .from("sources")
    .select("id, tenant_id, name")
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceLookupErr) {
    return NextResponse.json(
      { ok: false, code: "SOURCE_LOOKUP_FAILED", message: sourceLookupErr.message },
      { status: 400 },
    );
  }

  if (!source?.tenant_id) {
    return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND", message: "Credential not found" }, { status: 404 });
  }

  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("tenant_id", source.tenant_id)
    .limit(1)
    .maybeSingle();

  if (membershipErr) {
    return NextResponse.json(
      { ok: false, code: "TENANT_LOOKUP_FAILED", message: membershipErr.message },
      { status: 400 },
    );
  }

  if (!membership?.tenant_id || membership.role !== "admin") {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  // ── Pre-flight: only block on NON-archived portals ──
  const { data: blockingPortals, error: portalCheckErr } = await supabase
    .from("client_portals")
    .select("id, name")
    .eq("tenant_id", source.tenant_id)
    .eq("source_id", sourceId)
    .neq("status", "archived");

  if (portalCheckErr) {
    return NextResponse.json(
      { ok: false, code: "PORTAL_CHECK_FAILED", message: "Could not verify linked portals. Please try again." },
      { status: 500 },
    );
  }

  if (blockingPortals && blockingPortals.length > 0) {
    const portalNames = blockingPortals.map((p) => p.name).join(", ");
    const count = blockingPortals.length;
    return NextResponse.json(
      {
        ok: false,
        code: "CONNECTION_IN_USE",
        message: `This connection has ${count} active client portal${count > 1 ? "s" : ""} (${portalNames}). Delete ${count > 1 ? "those portals" : "that portal"} first, then try again.`,
        blockingResource: "client_portals",
        blockingPortals: blockingPortals.map((p) => ({ id: p.id, name: p.name })),
      },
      { status: 409 },
    );
  }

  // Check portal_entities junction — only block on NON-archived portals
  const { data: blockingJunction } = await supabase
    .from("portal_entities")
    .select("portal_id")
    .eq("source_id", sourceId);

  if (blockingJunction && blockingJunction.length > 0) {
    const junctionPortalIds = [...new Set(blockingJunction.map((r) => r.portal_id))];
    const { data: activeJunctionPortals } = await supabase
      .from("client_portals")
      .select("id, name")
      .in("id", junctionPortalIds)
      .neq("status", "archived");

    if (activeJunctionPortals && activeJunctionPortals.length > 0) {
      const names = activeJunctionPortals.map((p) => p.name).join(", ");
      const count = activeJunctionPortals.length;
      return NextResponse.json(
        {
          ok: false,
          code: "CONNECTION_IN_USE",
          message: `This connection is referenced by ${count} active client portal${count > 1 ? "s" : ""} (${names}). Delete ${count > 1 ? "those portals" : "that portal"} first, then try again.`,
          blockingResource: "portal_entities",
        },
        { status: 409 },
      );
    }
  }

  // ── Clean up any remaining archived portal FK references ──
  // Handles portals archived BEFORE this fix was deployed

  // 1. Clean portal_entities junction rows for archived portals
  const { data: allJunctionRefs } = await supabase
    .from("portal_entities")
    .select("portal_id")
    .eq("source_id", sourceId);

  if (allJunctionRefs && allJunctionRefs.length > 0) {
    const refPortalIds = [...new Set(allJunctionRefs.map((r) => r.portal_id))];
    const { data: archivedPortals } = await supabase
      .from("client_portals")
      .select("id")
      .in("id", refPortalIds)
      .eq("status", "archived");

    if (archivedPortals && archivedPortals.length > 0) {
      const archivedIds = archivedPortals.map((p) => p.id);
      await supabase
        .from("portal_entities")
        .delete()
        .in("portal_id", archivedIds)
        .eq("source_id", sourceId);
    }
  }

  // 2. NULL out entity_id/source_id on archived portals referencing this source
  await supabase
    .from("client_portals")
    .update({ entity_id: null, source_id: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", source.tenant_id)
    .eq("source_id", sourceId)
    .eq("status", "archived");

  // ── Now safe to delete source_entities ──
  const { error: entitiesErr } = await supabase
    .from("source_entities")
    .delete()
    .eq("tenant_id", source.tenant_id)
    .eq("source_id", sourceId);

  if (entitiesErr) {
    const isFkViolation =
      entitiesErr.code === "23503" ||
      entitiesErr.message?.includes("violates foreign key constraint");

    if (isFkViolation) {
      return NextResponse.json(
        {
          ok: false,
          code: "CONNECTION_IN_USE",
          message: "This connection can't be deleted because it's still linked to client portals or other resources. Remove those links first, then try again.",
          blockingResource: "unknown",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, code: "PERSISTENCE_FAILED", message: "Failed to remove connection data. Please try again." },
      { status: 400 },
    );
  }

  // ── Delete the source itself ──
  const { data: deleted, error: sourceErr } = await supabase
    .from("sources")
    .delete()
    .eq("tenant_id", source.tenant_id)
    .eq("id", sourceId)
    .select("id");

  if (sourceErr) {
    const isFkViolation =
      sourceErr.code === "23503" ||
      sourceErr.message?.includes("violates foreign key constraint");

    if (isFkViolation) {
      let friendlyMessage = "This connection can't be deleted because it's used by other resources. Remove those first, then try again.";
      if (sourceErr.message?.includes("client_portals")) {
        friendlyMessage = "This connection can't be deleted because it's used by one or more portals. Delete those portals first.";
      }
      return NextResponse.json(
        { ok: false, code: "CONNECTION_IN_USE", message: friendlyMessage },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, code: "PERSISTENCE_FAILED", message: sourceErr.message },
      { status: 400 },
    );
  }

  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "DELETE_NOOP",
        message: "Delete did not remove the credential. This usually means Supabase RLS blocked DELETE on sources.",
        debug: { sourceId, tenantId: source.tenant_id },
      },
      { status: 409 },
    );
  }

  void logActivity(supabase, {
    tenantId: source.tenant_id,
    actorId: user.id,
    actorType: "user",
    category: "connection",
    action: "disconnected",
    status: "info",
    entityType: "source",
    entityId: sourceId,
    entityName: source.name ?? null,
    message: source.name
      ? `Disconnected source connection "${source.name}"`
      : "Disconnected a source connection",
    details: { source_id: sourceId },
  });

  return NextResponse.json({ ok: true });
});