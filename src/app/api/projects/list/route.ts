
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeType(v: any): "analytics" | "tool" | "form" | "all" {
  if (v === "analytics" || v === "tool" || v === "form") return v;
  return "all";
}

function safeStatus(v: any): "live" | "draft" | "all" {
  if (v === "live" || v === "draft") return v;
  return "all";
}

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
  const q = String(searchParams.get("q") || "").trim();
  const type = safeType(searchParams.get("type"));
  const status = safeStatus(searchParams.get("status"));
  const pub = String(searchParams.get("public") || "all");

  let query = supabase
    .from("projects")
    .select("id,name,type,status,public_enabled,updated_at")
    .eq("tenant_id", membership.tenant_id)
    .order("updated_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (type !== "all") query = query.eq("type", type);
  if (status !== "all") query = query.eq("status", status);
  if (pub === "public") query = query.eq("public_enabled", true);
  if (pub === "private") query = query.eq("public_enabled", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });

  const projects = (data ?? []).map((p: any) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    type: String(p.type ?? "analytics"),
    status: String(p.status ?? "draft"),
    publicEnabled: Boolean(p.public_enabled),
    clientCount: 0,
    updatedAt: String(p.updated_at ?? ""),
  }));

  return NextResponse.json({ ok: true, projects });
}
