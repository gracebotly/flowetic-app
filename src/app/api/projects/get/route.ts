


import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, code: "MISSING_ID" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .select("id,name,type,status,description,public_enabled,created_at,updated_at,tenant_id")
    .eq("tenant_id", membership.tenant_id)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    project: {
      id: String(data.id),
      name: String(data.name ?? ""),
      type: String(data.type ?? "analytics"),
      status: String(data.status ?? "draft"),
      description: data.description ? String(data.description) : null,
      publicEnabled: Boolean((data as any).public_enabled),
      createdAt: String((data as any).created_at ?? ""),
      updatedAt: String((data as any).updated_at ?? ""),
    },
  });
}


