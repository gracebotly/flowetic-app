import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/logActivity";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  // Look up source without tenant scoping first so we can resolve tenant deterministically.
  // NOTE: This does not leak secrets; we only read tenant_id.
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

  // Ensure user is admin in this tenant (matches RLS policy expectations)
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

  // ── Pre-flight: check if any client portals reference entities from this source ──
  const { data: blockingPortals, error: portalCheckErr } = await supabase
    .from("client_portals")
    .select("id, name")
    .eq("tenant_id", source.tenant_id)
    .eq("source_id", sourceId);

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
        message: `This connection has ${count} active client portal${count > 1 ? "s" : ""} (${portalNames}). Delete or reassign ${count > 1 ? "those portals" : "that portal"} first, then try again.`,
        blockingResource: "client_portals",
        blockingPortals: blockingPortals.map((p) => ({ id: p.id, name: p.name })),
      },
      { status: 409 },
    );
  }

  // Also check portal_entities junction table for cross-platform references
  const { data: blockingJunction } = await supabase
    .from("portal_entities")
    .select("portal_id, entity_id")
    .eq("source_id", sourceId)
    .limit(1);

  if (blockingJunction && blockingJunction.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONNECTION_IN_USE",
        message: "This connection is referenced by one or more client portals. Remove those portal references first, then try again.",
        blockingResource: "portal_entities",
      },
      { status: 409 },
    );
  }

  // Safe to delete — no portals reference these entities
  const { error: entitiesErr } = await supabase
    .from("source_entities")
    .delete()
    .eq("tenant_id", source.tenant_id)
    .eq("source_id", sourceId);

  if (entitiesErr) {
    // Catch any remaining FK violations gracefully
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

  const { data: deleted, error: sourceErr } = await supabase
    .from("sources")
    .delete()
    .eq("tenant_id", source.tenant_id)
    .eq("id", sourceId)
    .select("id");

  if (sourceErr) {
    // Detect FK constraint violations and return friendly messages
    const isFkViolation =
      sourceErr.code === "23503" ||
      sourceErr.message?.includes("violates foreign key constraint");

    if (isFkViolation) {
      // Determine which table is blocking the delete
      let friendlyMessage = "This connection can't be deleted because it's used by other resources. Remove those first, then try again.";
      let blockingResource = "resources";

      if (sourceErr.message?.includes("offerings")) {
        friendlyMessage = "This connection can't be deleted because it's used by one or more offerings. Delete or reassign those offerings first.";
        blockingResource = "offerings";
      } else if (sourceErr.message?.includes("portals") || sourceErr.message?.includes("interfaces")) {
        friendlyMessage = "This connection can't be deleted because it's used by one or more portals. Delete or reassign those portals first.";
        blockingResource = "portals";
      } else if (sourceErr.message?.includes("events")) {
        friendlyMessage = "This connection can't be deleted because it has associated event data. Clear the events first.";
        blockingResource = "events";
      }

      return NextResponse.json(
        {
          ok: false,
          code: "CONNECTION_IN_USE",
          message: friendlyMessage,
          blockingResource,
        },
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
        message:
          "Delete did not remove the credential. This usually means Supabase RLS blocked DELETE on sources. Add a DELETE policy for sources (admin-only) matching your UPDATE policy.",
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
}
