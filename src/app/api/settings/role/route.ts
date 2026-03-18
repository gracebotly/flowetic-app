import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

// ── GET /api/settings/role ──────────────────────────────────
// Returns the current user's role for their tenant.
// Any authenticated member can read their own role.
export const GET = withApiHandler(async function GET() {
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
});