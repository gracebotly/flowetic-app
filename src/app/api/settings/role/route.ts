import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

// ── GET /api/settings/role ──────────────────────────────────
// Returns the current user's role for their tenant.
// Any authenticated member can read their own role.
export async function GET() {
  const auth = await getTenantAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code },
      { status: auth.status }
    );
  }

  return NextResponse.json({
    ok: true,
    role: auth.role,
    tenantId: auth.tenantId,
  });
}
