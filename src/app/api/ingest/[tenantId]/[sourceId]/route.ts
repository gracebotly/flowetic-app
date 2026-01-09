
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; sourceId: string }> },
) {
  const supabase = await createClient();

  const { tenantId, sourceId } = await params;

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";

  if (!tenantId || !sourceId) {
    return NextResponse.json({ ok: false, code: "MISSING_PARAMS" }, { status: 400 });
  }

  // Lookup the source (tenant-scoped)
  const { data: source, error: sourceErr } = await supabase
    .from("sources")
    .select("id, tenant_id, type, secret_hash, status")
    .eq("id", sourceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (sourceErr) {
    return NextResponse.json({ ok: false, code: "DB_ERROR", message: sourceErr.message }, { status: 500 });
  }

  if (!source) {
    return NextResponse.json({ ok: false, code: "SOURCE_NOT_FOUND" }, { status: 404 });
  }

  // Validate secret (embedded in URL so user only pastes one thing)
  const secret = source.secret_hash ? decryptSecret(String(source.secret_hash)) : null;
  let secretJson: any = null;
  try {
    secretJson = secret ? JSON.parse(secret) : null;
  } catch {
    secretJson = null;
  }

  const expected = secretJson?.webhookSecret ? String(secretJson.webhookSecret) : "";
  if (!expected || !key || key !== expected) {
    return NextResponse.json({ ok: false, code: "INVALID_WEBHOOK_KEY" }, { status: 401 });
  }

  // Store raw payload as a normalized "event" row.
  // Keep it minimal: one event per webhook call. You can refine mapping later.
  const body = await req.json().catch(() => null);

  const nowIso = new Date().toISOString();

  const { error: insertErr } = await supabase.from("events").insert({
    tenant_id: tenantId,
    source_id: sourceId,
    interface_id: null,
    run_id: null,
    type: "tool_event",
    name: source.type === "make" ? "make.webhook" : "webhook",
    value: null,
    unit: null,
    text: null,
    state: body,
    labels: { platform: source.type, method: "webhook" },
    timestamp: nowIso,
    created_at: nowIso,
  });

  if (insertErr) {
    return NextResponse.json({ ok: false, code: "PERSISTENCE_FAILED", message: insertErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
