import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  const { error } = await supabase
    .from("source_entities")
    .update({ enabled_for_analytics: false })
    .eq("source_id", sourceId)
    .eq("external_id", externalId);

  if (error) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
