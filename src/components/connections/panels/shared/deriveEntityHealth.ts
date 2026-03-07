import type { EntityHealth } from './HealthBanner';

interface StatsInput {
  totalEvents: number;
  successEvents: number;
  successRate: number;
  latestError?: string | null;
}

export function deriveEntityHealth(
  stats: StatsInput | null,
  fetchError?: string | null
): EntityHealth {
  if (fetchError) {
    return { status: 'fetch-error', error: fetchError };
  }

  if (!stats || stats.totalEvents === 0) {
    return { status: 'no-data', entityKind: 'entity' };
  }

  const errorRate = stats.totalEvents > 0
    ? Math.round(((stats.totalEvents - stats.successEvents) / stats.totalEvents) * 100)
    : 0;

  const errorCount = stats.totalEvents - stats.successEvents;

  if (errorRate === 100) {
    return {
      status: 'critical',
      errorRate: 100,
      latestError: stats.latestError ?? 'All recent executions failed',
    };
  }

  if (errorRate >= 30) {
    return {
      status: 'degraded',
      errorRate,
      errorCount,
    };
  }

  return { status: 'healthy' };
}
