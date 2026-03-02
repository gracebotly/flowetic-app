import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

// ── Tiered platform fee by plan ──────────────────────────────
const PLAN_FEE_MAP: Record<string, number> = {
  free: 5, // Free/Starter tier — 5% platform fee
  starter: 5,
  pro: 2, // Pro tier — 2% platform fee
  enterprise: 0, // Enterprise — 0% platform fee
};

/**
 * Resolve platform fee percent for a tenant based on their plan.
 * Falls back to tenant-level override if set, otherwise uses plan-based fee.
 */
export function resolveApplicationFeePercent(
  plan: string,
  tenantOverride?: number | null
): number {
  if (tenantOverride !== null && tenantOverride !== undefined) {
    return tenantOverride;
  }
  return PLAN_FEE_MAP[plan] ?? 5; // default 5% for unknown plans
}

/**
 * Calculate application fee in cents.
 */
export function calculateApplicationFee(
  amountCents: number,
  feePercent: number
): number {
  return Math.round(amountCents * (feePercent / 100));
}
