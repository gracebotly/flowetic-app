export const PLAN_LIMITS = {
  agency: {
    label: "Agency",
    price_cents: 14900,
    portal_limit: 5,
    team_limit: 1,
    platform_fee_percent: 5,
    custom_domain: true,
    api_access: false,
  },
  scale: {
    label: "Scale",
    price_cents: 29900,
    portal_limit: 15,
    team_limit: Infinity,
    platform_fee_percent: 2,
    custom_domain: true,
    api_access: false,
  },
  enterprise: {
    label: "Enterprise",
    price_cents: null,
    portal_limit: Infinity,
    team_limit: Infinity,
    platform_fee_percent: 0,
    custom_domain: true,
    api_access: true,
  },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

export const TRIAL_DAYS_WITH_CARD = 14;
export const TRIAL_DAYS_WITHOUT_CARD = 7;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.agency;
}
