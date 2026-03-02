/**
 * Compute client health score (0–100).
 * Pure function — no DB calls, caller passes data.
 *
 * Formula:
 *   Recency    (40%): days since last portal view → 100 (today) to 0 (30+ days)
 *   Engagement (30%): portal views in last 30 days → capped at 100
 *   Coverage   (20%): assigned offerings / total offerings → 0–100
 *   Status     (10%): active = 100, paused = 0
 */

interface HealthInput {
  lastSeenAt: string | null;       // ISO timestamp or null
  viewsLast30Days: number;         // count of portal views
  assignedOfferings: number;       // offerings with this client_id
  totalOfferings: number;          // all offerings for tenant
  status: "active" | "paused";
}

export function computeHealthScore(input: HealthInput): number {
  // Recency (40%)
  let recency = 0;
  if (input.lastSeenAt) {
    const daysSince = Math.max(
      0,
      (Date.now() - new Date(input.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    recency = Math.max(0, Math.round(100 - (daysSince / 30) * 100));
  }

  // Engagement (30%) — cap at 50 views = 100 score
  const engagement = Math.min(100, Math.round((input.viewsLast30Days / 50) * 100));

  // Coverage (20%)
  const coverage =
    input.totalOfferings > 0
      ? Math.round((input.assignedOfferings / input.totalOfferings) * 100)
      : 0;

  // Status (10%)
  const statusScore = input.status === "active" ? 100 : 0;

  const score = Math.round(
    recency * 0.4 + engagement * 0.3 + coverage * 0.2 + statusScore * 0.1
  );

  return Math.max(0, Math.min(100, score));
}

export interface HealthBreakdown {
  overall: number;
  recency: number;
  engagement: number;
  coverage: number;
  status: number;
}

export function computeHealthBreakdown(input: HealthInput): HealthBreakdown {
  let recency = 0;
  if (input.lastSeenAt) {
    const daysSince = Math.max(
      0,
      (Date.now() - new Date(input.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    recency = Math.max(0, Math.round(100 - (daysSince / 30) * 100));
  }

  const engagement = Math.min(100, Math.round((input.viewsLast30Days / 50) * 100));

  const coverage =
    input.totalOfferings > 0
      ? Math.round((input.assignedOfferings / input.totalOfferings) * 100)
      : 0;

  const statusScore = input.status === "active" ? 100 : 0;

  const overall = Math.round(
    recency * 0.4 + engagement * 0.3 + coverage * 0.2 + statusScore * 0.1
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    recency,
    engagement,
    coverage,
    status: statusScore,
  };
}
