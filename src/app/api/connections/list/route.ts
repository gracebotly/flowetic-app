

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const { data, error } = await supabase
    .from("sources")
    .select("id,type,name,status,created_at")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sources: data ?? [] });
}


