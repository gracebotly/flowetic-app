
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

type ConnectMethod = "api" | "webhook" | "mcp";

type CredentialRow = {
  id: string;
  platformType: string;
  name: string;
  status: string | null;
  method: ConnectMethod;
  created_at: string;
  updated_at: string;
};

function safeMethod(v: unknown): ConnectMethod {
  return v === "api" || v === "webhook" || v === "mcp" ? v : "api";
}

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

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  // IMPORTANT:
  // - We need secret_hash to derive method (api/webhook/mcp)
  // - We need created_at and updated_at to display Created / Last updated (n8n-like)
  const { data, error } = await supabase
    .from("sources")
    .select("id,type,name,status,created_at,updated_at,secret_hash")
    .eq("tenant_id", membership.tenant_id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });
  }

  const rows: CredentialRow[] = (data ?? []).map((s: any) => {
    let method: ConnectMethod = "api";

    // secret_hash contains JSON with `{ method, platformType, ... }` encrypted (see connections/connect route)
    try {
      if (typeof s.secret_hash === "string" && s.secret_hash.length > 0) {
        const decrypted = decryptSecret(s.secret_hash);
        const parsed = JSON.parse(decrypted);
        method = safeMethod(parsed?.method);
      }
    } catch {
      // keep default
    }

    return {
      id: String(s.id),
      platformType: String(s.type),
      name: String(s.name ?? ""),
      status: (s.status ?? null) as string | null,
      method,
      created_at: String(s.created_at ?? ""),
      updated_at: String(s.updated_at ?? s.created_at ?? ""),
    };
  });

  return NextResponse.json({ ok: true, credentials: rows });
}

