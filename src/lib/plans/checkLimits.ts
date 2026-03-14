import type { SupabaseClient } from "@supabase/supabase-js";

export type LimitCheckResult = {
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
  reason?: string | null;
};

export async function checkPortalLimit(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LimitCheckResult> {
  const { data, error } = await supabase.rpc("check_portal_limit", {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(`Portal limit check failed: ${error.message}`);
  return data as LimitCheckResult;
}

export async function checkTeamLimit(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LimitCheckResult> {
  const { data, error } = await supabase.rpc("check_team_limit", {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(`Team limit check failed: ${error.message}`);
  return data as LimitCheckResult;
}
