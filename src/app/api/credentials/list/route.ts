
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

type ConnectMethod = "api" | "webhook";

type CredentialRow = {
  id: string;
  platformType: string;
  name: string;
  status: string | null;
  method: ConnectMethod;
  created_at: string;
  updated_at: string;
  instanceUrl?: string;
};

function safeMethod(v: unknown): ConnectMethod {
  return v === "api" || v === "webhook" ? v : "api";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("sources")
    .select("id,type,name,status,created_at,method,secret_hash")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, code: "UNKNOWN_ERROR", message: error.message }, { status: 500 });
  }

  const rows: CredentialRow[] = (data ?? []).map((s: any) => {
    let instanceUrl: string | undefined;
    
    // For n8n API method credentials, decrypt and extract instanceUrl
    if (
      String(s.type) === "n8n" &&
      safeMethod((s as any).method) === "api" &&
      s.secret_hash
    ) {
      try {
        const decrypted = decryptSecret(String(s.secret_hash));
        const secret = decrypted ? JSON.parse(decrypted) : null;
        if (secret?.instanceUrl) instanceUrl = String(secret.instanceUrl);
      } catch {
        instanceUrl = undefined;
      }
    }
    
    return {
      id: String(s.id),
      platformType: String(s.type),
      name: String(s.name ?? ""),
      status: (s.status ?? null) as string | null,
      method: safeMethod((s as any).method),
      created_at: String(s.created_at ?? ""),
      updated_at: String((s as any).updated_at ?? s.created_at ?? ""),
      instanceUrl,
    };
  });

  return NextResponse.json({ ok: true, credentials: rows });
}

