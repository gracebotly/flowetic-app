import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipErr) {
    return NextResponse.json(
      { ok: false, code: "MEMBERSHIP_LOOKUP_FAILED", message: membershipErr.message },
      { status: 400 },
    );
  }

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const sourceId = String(body?.sourceId ?? "").trim();

  if (!sourceId) {
    return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });
  }

  // Verify source belongs to tenant
  const { data: source, error: sourceLookupErr } = await supabase
    .from("sources")
    .select("id")
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (sourceLookupErr) {
    return NextResponse.json(
      { ok: false, code: "SOURCE_LOOKUP_FAILED", message: sourceLookupErr.message },
      { status: 400 },
    );
  }

  if (!source) {
    return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  }

  // IMPORTANT:
  // 1) Delete dependent rows first (prevents FK constraint failures).
  // 2) Scope to tenant_id to avoid RLS failures or cross-tenant accidental ops.
  const { error: entitiesErr } = await supabase
    .from("source_entities")
    .delete()
    .eq("tenant_id", membership.tenant_id)
    .eq("source_id", sourceId);

  if (entitiesErr) {
    return NextResponse.json(
      { ok: false, code: "PERSISTENCE_FAILED", message: entitiesErr.message },
      { status: 400 },
    );
  }

  // Then delete the source itself (scoped to tenant)
  const { error: sourceErr } = await supabase
    .from("sources")
    .delete()
    .eq("tenant_id", membership.tenant_id)
    .eq("id", sourceId);

  if (sourceErr) {
    return NextResponse.json(
      { ok: false, code: "PERSISTENCE_FAILED", message: sourceErr.message },
      { status: 400 },
    );
  }

  // Post-delete verification: never return ok:true if still present
  const { data: stillExists, error: verifyErr } = await supabase
    .from("sources")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("id", sourceId)
    .maybeSingle();

  if (verifyErr) {
    return NextResponse.json(
      { ok: false, code: "VERIFY_FAILED", message: verifyErr.message },
      { status: 400 },
    );
  }

  if (stillExists) {
    return NextResponse.json(
      {
        ok: false,
        code: "DELETE_INCOMPLETE",
        message: "Credential was not removed. Please try again.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
