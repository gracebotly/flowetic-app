import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

// ── Tiered platform fee by plan ──────────────────────────────
const PLAN_FEE_MAP: Record<string, number> = {
  agency: 5,      // Agency tier — 5% platform fee
  scale: 2,       // Scale tier — 2% platform fee
  enterprise: 0,  // Enterprise — 0% platform fee
  // Legacy names (fallback for old data)
  free: 5,
  starter: 5,
  pro: 2,
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
