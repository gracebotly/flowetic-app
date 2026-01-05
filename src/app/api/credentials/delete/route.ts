import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const { sourceId } = body;

  if (!sourceId) {
    return NextResponse.json({ ok: false, code: "MISSING_SOURCE_ID" }, { status: 400 });
  }

  // First delete all associated entities
  await supabase
    .from("source_entities")
    .delete()
    .eq("source_id", sourceId);

  // Then delete the credential
  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("id", sourceId)
    .eq("tenant_id", membership.tenant_id); // Security: ensure tenant owns the credential

  if (error) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
