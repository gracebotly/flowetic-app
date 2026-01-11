import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, tenant_id")
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

  // Delete dependent rows first (prevents FK issues)
  const { error: entitiesErr } = await supabase
    .from("source_entities")
    .delete()
    .eq("tenant_id", source.tenant_id)
    .eq("source_id", sourceId);

  if (entitiesErr) {
    return NextResponse.json(
      { ok: false, code: "PERSISTENCE_FAILED", message: entitiesErr.message },
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

  return NextResponse.json({ ok: true });
}
