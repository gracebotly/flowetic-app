


import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeType(v: any): "analytics" | "tool" | "form" | null {
  if (v === "analytics" || v === "tool" || v === "form") return v;
  return null;
}

function safeStatus(v: any): "live" | "draft" | null {
  if (v === "live" || v === "draft") return v;
  return null;
}

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

  if (!membership?.tenant_id) return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, code: "MISSING_ID" }, { status: 400 });

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = safeType(body?.type);
  const status = safeStatus(body?.status);
  const description = typeof body?.description === "string" ? body.description : "";

  if (!name) return NextResponse.json({ ok: false, code: "MISSING_NAME", message: "Project name is required." }, { status: 400 });
  if (!type) return NextResponse.json({ ok: false, code: "MISSING_TYPE", message: "Project type is required." }, { status: 400 });
  if (!status) return NextResponse.json({ ok: false, code: "MISSING_STATUS", message: "Project status is required." }, { status: 400 });

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      type,
      status,
      description,
      updated_at: now,
    })
    .eq("tenant_id", membership.tenant_id)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}


