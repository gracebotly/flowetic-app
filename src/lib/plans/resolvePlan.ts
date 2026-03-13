import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantPlan = {
  plan: string;
  plan_status: string;
  trial_ends_at: string | null;
  has_card_on_file: boolean;
  is_active: boolean;
  is_trialing: boolean;
  trial_expired: boolean;
};

export async function resolveTenantPlan(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantPlan> {
  const { data, error } = await supabase
    .from("tenants")
    .select("plan, plan_status, trial_ends_at, has_card_on_file")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return {
      plan: "agency",
      plan_status: "trialing",
      trial_ends_at: null,
      has_card_on_file: false,
      is_active: false,
      is_trialing: false,
      trial_expired: true,
    };
  }

  const trialExpired =
    data.plan_status === "trialing" &&
    !!data.trial_ends_at &&
    new Date(data.trial_ends_at) < new Date();

  return {
    plan: data.plan,
    plan_status: data.plan_status,
    trial_ends_at: data.trial_ends_at,
    has_card_on_file: data.has_card_on_file ?? false,
    is_active: data.plan_status === "active",
    is_trialing: data.plan_status === "trialing" && !trialExpired,
    trial_expired: !!trialExpired,
  };
}
