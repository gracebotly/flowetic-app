import { createClient } from "@/lib/supabase/server";

type AuthResult =
  | { ok: true; tenantId: string; userId: string; role: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; status: number; code: string };

/**
 * Shared auth helper for settings API routes.
 * - Validates user session via Supabase auth
 * - Looks up membership to get tenantId + role
 * - Optionally enforces admin role
 *
 * Pattern matches existing route auth (see src/app/api/offerings/[id]/route.ts)
 * but returns role info and avoids copy-paste.
 */
export async function getTenantAdmin(options?: { requireAdmin?: boolean }): Promise<AuthResult> {
  const requireAdmin = options?.requireAdmin ?? false;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, code: "AUTH_REQUIRED" };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: false, status: 403, code: "TENANT_ACCESS_DENIED" };
  }

  if (requireAdmin && membership.role !== "admin") {
    return { ok: false, status: 403, code: "ADMIN_REQUIRED" };
  }

  return {
    ok: true,
    tenantId: membership.tenant_id,
    userId: user.id,
    role: membership.role,
    supabase,
  };
}
