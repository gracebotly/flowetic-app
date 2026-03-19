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
  has_ever_paid?: boolean;
  plan_updated_at: string | null;
}): BlockInfo {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  // 1a. Pay-now user who never completed Stripe checkout → HARD BLOCK
  //     These users chose "buy now" (trial_ends_at is null because trial=0)
  //     but never finished paying. Applies to both Agency and Scale buy-now.
  if (
    tenant.plan_status === "trialing" &&
    !tenant.trial_ends_at &&
    !tenant.has_card_on_file &&
    !tenant.has_ever_paid
  ) {
    return { level: "hard_block", reason: "trial_expired", daysRemaining: null };
  }

  // 1b. Trial expired without ever paying → HARD BLOCK (freeloader)
  //     This catches both: never added card, AND added card but never got charged
  if (
    tenant.plan_status === "trialing" &&
    tenant.trial_ends_at &&
    new Date(tenant.trial_ends_at).getTime() < now &&
    !tenant.has_ever_paid
  ) {
    return { level: "hard_block", reason: "trial_expired", daysRemaining: null };
  }

  // 2. Cancelled subscription
  if (tenant.plan_status === "cancelled" && tenant.plan_updated_at) {
    const cancelledAt = new Date(tenant.plan_updated_at).getTime();
    const daysSince = Math.floor((now - cancelledAt) / msPerDay);

    // Never paid → hard block immediately (freeloader who cancelled during trial)
    if (!tenant.has_ever_paid) {
      return { level: "hard_block", reason: "cancelled", daysRemaining: null };
    }

    // Paid before → soft block with 30-day grace
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

    // Never paid → hard block immediately (card added during trial then bounced)
    if (!tenant.has_ever_paid) {
      return { level: "hard_block", reason: "payment_failed", daysRemaining: null };
    }

    // Paid before → soft block with 30-day countdown
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
