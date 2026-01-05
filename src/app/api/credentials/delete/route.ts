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
  if (!sourceId) return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });

  // Delete source_entities first (avoid orphaned index rows)
  const { error: eErr } = await supabase
    .from("source_entities")
    .delete()
    .eq("source_id", sourceId);

  if (eErr) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: eErr.message }, { status: 400 });

  // Delete the source row
  const { error: sErr } = await supabase
    .from("sources")
    .delete()
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id);

  if (sErr) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: sErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
