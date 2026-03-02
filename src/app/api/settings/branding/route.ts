import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── GET /api/settings/branding ──────────────────────────────
// Returns branding fields. Any authenticated member can read.
export async function GET() {
  const auth = await getTenantAdmin();
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const { data: tenant, error } = await auth.supabase
    .from("tenants")
    .select("logo_url, primary_color, secondary_color, welcome_message, brand_footer")
    .eq("id", auth.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    return json(500, { ok: false, code: "FETCH_FAILED" });
  }

  return json(200, { ok: true, branding: tenant });
}

// ── PATCH /api/settings/branding ────────────────────────────
// Updates branding fields. Admin only.
export async function PATCH(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: "INVALID_JSON" });
  }

  const allowedFields = ["primary_color", "secondary_color", "welcome_message", "brand_footer"];
  const updates: Record<string, unknown> = {};

  for (const key of allowedFields) {
    if (key in body) {
      const val = body[key];
      if (typeof val === "string") {
        updates[key] = val.trim();
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return json(400, { ok: false, code: "NO_UPDATES" });
  }

  // Validate hex colors if provided
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (updates.primary_color && !hexRegex.test(updates.primary_color as string)) {
    return json(400, { ok: false, code: "INVALID_COLOR", field: "primary_color" });
  }
  if (updates.secondary_color && !hexRegex.test(updates.secondary_color as string)) {
    return json(400, { ok: false, code: "INVALID_COLOR", field: "secondary_color" });
  }

  updates.updated_at = new Date().toISOString();

  const { data: tenant, error } = await auth.supabase
    .from("tenants")
    .update(updates)
    .eq("id", auth.tenantId)
    .select("logo_url, primary_color, secondary_color, welcome_message, brand_footer")
    .maybeSingle();

  if (error || !tenant) {
    console.error("[PATCH /api/settings/branding] Update failed:", error);
    return json(500, { ok: false, code: "UPDATE_FAILED" });
  }

  return json(200, { ok: true, branding: tenant });
}
