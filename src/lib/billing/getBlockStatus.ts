const PAST_DUE_GRACE_DAYS = 3;
const SOFT_BLOCK_GRACE_DAYS = 30;

export type BlockLevel = "hard_block" | "soft_block" | null;

export type BlockInfo = {
  level: BlockLevel;
  reason: "trial_expired" | "cancelled" | "payment_failed" | null;
  daysRemaining: number | null;
};

export function getBlockStatus(tenant: {
  plan_status: string;
  trial_ends_at: string | null;
  has_card_on_file: boolean;
  plan_updated_at: string | null;
}): BlockInfo {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  // 1. Trial expired without ever adding a card → HARD BLOCK (freeloader)
  if (
    tenant.plan_status === "trialing" &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at).getTime() < now &&
    !tenant.has_card_on_file
  ) {
    return { level: "hard_block", reason: "trial_expired", daysRemaining: null };
  }

  // 2. Cancelled subscription (they paid before)
  if (tenant.plan_status === "cancelled" && tenant.plan_updated_at) {
    const cancelledAt = new Date(tenant.plan_updated_at).getTime();
    const daysSince = Math.floor((now - cancelledAt) / msPerDay);
    const daysLeft = SOFT_BLOCK_GRACE_DAYS - daysSince;

    if (daysLeft > 0) {
      return { level: "soft_block", reason: "cancelled", daysRemaining: daysLeft };
    }
    return { level: "hard_block", reason: "cancelled", daysRemaining: 0 };
  }

  // 3. Past due for more than 3 days (card bounce grace expired)
  if (tenant.plan_status === "past_due" && tenant.plan_updated_at) {
    const pastDueSince = new Date(tenant.plan_updated_at).getTime();
    const daysPastDue = Math.floor((now - pastDueSince) / msPerDay);

    if (daysPastDue <= PAST_DUE_GRACE_DAYS) {
      // Within 3-day grace → no block yet
      return { level: null, reason: null, daysRemaining: null };
    }

    // Past 3-day grace → soft block with 30-day countdown from when past_due started
    const daysIntoSoftBlock = daysPastDue - PAST_DUE_GRACE_DAYS;
    const daysLeft = SOFT_BLOCK_GRACE_DAYS - daysIntoSoftBlock;

    if (daysLeft > 0) {
      return { level: "soft_block", reason: "payment_failed", daysRemaining: daysLeft };
    }
    return { level: "hard_block", reason: "payment_failed", daysRemaining: 0 };
  }

  // 4. No block
  return { level: null, reason: null, daysRemaining: null };
}
