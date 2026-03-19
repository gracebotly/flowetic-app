import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AuthResult =
  | { ok: true; tenantId: string; userId: string; role: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; status: number; code: string };

/**
 * Shared auth helper for settings API routes.
 * - Validates user session via Supabase auth
 * - Looks up membership to get tenantId + role
 * - Rejects soft-deleted tenants
 * - Optionally enforces admin role
 */
export async function getTenantAdmin(options?: { requireAdmin?: boolean; allowDeleted?: boolean }): Promise<AuthResult> {
  const requireAdmin = options?.requireAdmin ?? false;
  const allowDeleted = options?.allowDeleted ?? false;
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

  // Check if tenant is soft-deleted (unless explicitly allowed, e.g. for restore)
  if (!allowDeleted) {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("deleted_at")
      .eq("id", membership.tenant_id)
      .single();

    if (tenant?.deleted_at) {
      return { ok: false, status: 403, code: "WORKSPACE_DELETED" };
    }
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
