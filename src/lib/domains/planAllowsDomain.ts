/**
 * Check whether a tenant's plan and billing status allows custom domains.
 *
 * Rules:
 * - All paid plans (agency, scale, enterprise) get custom domains
 * - Free trial does NOT get custom domains
 * - Exception: if `has_ever_paid` is true (e.g., trial after previous subscription), allow
 *
 * The plan constants define `custom_domain: true/false` per plan.
 * This function adds the trial check on top.
 */

import { getPlanLimits } from '@/lib/plans/constants';

interface TenantBillingInfo {
  plan: string;
  plan_status: string;
  has_ever_paid: boolean;
}

export interface PlanDomainCheck {
  allowed: boolean;
  reason?: string;
}

export function planAllowsDomain(tenant: TenantBillingInfo): PlanDomainCheck {
  const limits = getPlanLimits(tenant.plan);

  // Plan doesn't include custom domains at all
  if (!limits.custom_domain) {
    return {
      allowed: false,
      reason: 'PLAN_UPGRADE_REQUIRED',
    };
  }

  // Plan allows it, but check if they're on a free trial
  if (tenant.plan_status === 'trialing' && !tenant.has_ever_paid) {
    return {
      allowed: false,
      reason: 'TRIAL_ACTIVE',
    };
  }

  return { allowed: true };
}
