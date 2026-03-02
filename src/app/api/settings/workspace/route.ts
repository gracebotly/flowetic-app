import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/settings/workspace ─────────────────────────────
// Returns workspace info. Any authenticated member can read.
export async function GET() {
  const auth = await getTenantAdmin();
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const { data: tenant, error } = await auth.supabase
    .from("tenants")
    .select("id, name, plan, timezone, created_at")
    .eq("id", auth.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  return json(200, { ok: true, workspace: tenant, role: auth.role });
}

// ── PATCH /api/settings/workspace ───────────────────────────
// Updates workspace name and/or timezone. Admin only.
export async function PATCH(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const allowedFields = ["name", "timezone"];
  const updates: Record<string, unknown> = {};

  for (const key of allowedFields) {
    if (key in body && typeof body[key] === "string" && (body[key] as string).trim().length > 0) {
      updates[key] = (body[key] as string).trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return json(400, { ok: false, code: "NO_UPDATES" });
  }

  // Validate timezone if provided
  if (updates.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: updates.timezone as string });
    } catch {
      return json(400, { ok: false, code: "INVALID_TIMEZONE" });
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data: tenant, error } = await auth.supabase
    .from("tenants")
    .update(updates)
    .eq("id", auth.tenantId)
    .select("id, name, plan, timezone, created_at, updated_at")
    .maybeSingle();

  if (error || !tenant) {
    console.error("[PATCH /api/settings/workspace] Update failed:", error);
    return json(500, { ok: false, code: "UPDATE_FAILED" });
  }

  return json(200, { ok: true, workspace: tenant });
}