import { getVoiceFieldMapping, getWorkflowFieldMapping } from './fieldMappings';

// ─── Types ───────────────────────────────────────────────────

export interface PortalEvent {
  id: string;
  type: string;
  state: Record<string, unknown>;
  labels: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export interface HeadlineMetrics {
  total: number;
  totalLabel: string;
  percentChange: number | null; // vs previous period
  periodLabel: string;
}

export interface KPICard {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'neutral';
}

export interface TrendDataPoint {
  date: string;      // YYYY-MM-DD
  count: number;
  successCount?: number;
  failCount?: number;
}

export interface TableRow {
  id: string;
  [key: string]: unknown;
}

export interface SkeletonData {
  headline: HeadlineMetrics;
  kpis: KPICard[];
  trend: TrendDataPoint[];
  recentRows: TableRow[];
  // Voice-specific extras
  endedReasonBreakdown?: { reason: string; count: number }[];
  assistantBreakdown?: { name: string; count: number; successRate: number }[];
  sentimentBreakdown?: { sentiment: string; count: number }[];
  costTrend?: { date: string; totalCost: number; avgCost: number }[];
  // Workflow-specific extras
  workflowBreakdown?: { name: string; count: number; successRate: number; avgDuration: number }[];
  errorBreakdown?: { message: string; count: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────

function getStateField(event: PortalEvent, fieldName: string): unknown {
  return event.state?.[fieldName] ?? event.labels?.[fieldName] ?? undefined;
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

function toDateString(val: unknown): string {
  if (!val) return '';
  try {
    return new Date(String(val)).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Voice Performance Transform ─────────────────────────────

export function transformVoiceData(events: PortalEvent[], platform: 'vapi' | 'retell'): SkeletonData {
  const fields = getVoiceFieldMapping(platform);
  
  if (events.length === 0) {
    return {
      headline: { total: 0, totalLabel: 'calls handled', percentChange: null, periodLabel: 'this month' },
      kpis: [
        { label: 'Success Rate', value: '—', color: 'neutral' },
        { label: 'Avg Duration', value: '—', color: 'neutral' },
        { label: 'Total Cost', value: '—', color: 'neutral' },
      ],
      trend: [],
      recentRows: [],
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Split events into current period (30d) and previous period (30-60d)
  const currentEvents = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);
  const previousEvents = events.filter(e => {
    const d = new Date(e.timestamp);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  // ── Headline ──
  const totalCurrent = currentEvents.length;
  const totalPrevious = previousEvents.length;
  const percentChange = calculatePercentChange(totalCurrent, totalPrevious);

  // ── KPIs ──
  const successCurrent = currentEvents.filter(e => 
    String(getStateField(e, fields.status)) === fields.statusSuccessValue
  ).length;
  const successRate = totalCurrent > 0 ? Math.round((successCurrent / totalCurrent) * 100) : 0;
  const successPrevious = previousEvents.length > 0
    ? Math.round((previousEvents.filter(e => String(getStateField(e, fields.status)) === fields.statusSuccessValue).length / previousEvents.length) * 100)
    : 0;

  const durations = currentEvents.map(e => toNumber(getStateField(e, fields.durationMs))).filter(d => d > 0);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const costs = currentEvents.map(e => toNumber(getStateField(e, fields.cost))).filter(c => c > 0);
  const totalCost = costs.reduce((a, b) => a + b, 0);

  // ── Trend (daily buckets) ──
  const dayBuckets = new Map<string, { count: number; success: number; fail: number }>();
  for (const event of currentEvents) {
    const day = toDateString(getStateField(event, fields.startedAt) || event.timestamp);
    if (!day) continue;
    const bucket = dayBuckets.get(day) ?? { count: 0, success: 0, fail: 0 };
    bucket.count++;
    if (String(getStateField(event, fields.status)) === fields.statusSuccessValue) {
      bucket.success++;
    } else {
      bucket.fail++;
    }
    dayBuckets.set(day, bucket);
  }
  const trend: TrendDataPoint[] = Array.from(dayBuckets.entries())
    .map(([date, b]) => ({ date, count: b.count, successCount: b.success, failCount: b.fail }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Recent Calls Table ──
  const recentRows: TableRow[] = currentEvents
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)
    .map(e => ({
      id: String(getStateField(e, fields.callId) || e.id),
      assistant: String(getStateField(e, fields.assistantName) || 'Unknown'),
      status: String(getStateField(e, fields.status) || 'unknown'),
      duration: formatDuration(toNumber(getStateField(e, fields.durationMs))),
      cost: formatCost(toNumber(getStateField(e, fields.cost))),
      endedReason: String(getStateField(e, fields.endedReason) || '—'),
      sentiment: String(getStateField(e, fields.sentiment) || '—'),
      time: new Date(e.timestamp).toLocaleString(),
    }));

  // ── Ended Reason Breakdown (Premium) ──
  const endedReasonMap = new Map<string, number>();
  for (const e of currentEvents) {
    const reason = String(getStateField(e, fields.endedReason) || 'unknown');
    endedReasonMap.set(reason, (endedReasonMap.get(reason) ?? 0) + 1);
  }
  const endedReasonBreakdown = Array.from(endedReasonMap.entries())
    .map(([reason, count]) => ({ reason: formatEndedReason(reason), count }))
    .sort((a, b) => b.count - a.count);

  // ── Assistant Breakdown (Premium) ──
  const assistantMap = new Map<string, { count: number; success: number }>();
  for (const e of currentEvents) {
    const name = String(getStateField(e, fields.assistantName) || 'Unknown');
    const entry = assistantMap.get(name) ?? { count: 0, success: 0 };
    entry.count++;
    if (String(getStateField(e, fields.status)) === fields.statusSuccessValue) entry.success++;
    assistantMap.set(name, entry);
  }
  const assistantBreakdown = Array.from(assistantMap.entries())
    .map(([name, d]) => ({ name, count: d.count, successRate: d.count > 0 ? Math.round((d.success / d.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // ── Sentiment Breakdown (Premium — Retell primarily) ──
  const sentimentMap = new Map<string, number>();
  for (const e of currentEvents) {
    const sent = String(getStateField(e, fields.sentiment) || '').trim();
    if (sent && sent !== '—' && sent !== 'undefined') {
      sentimentMap.set(sent, (sentimentMap.get(sent) ?? 0) + 1);
    }
  }
  const sentimentBreakdown = sentimentMap.size > 0
    ? Array.from(sentimentMap.entries()).map(([sentiment, count]) => ({ sentiment, count })).sort((a, b) => b.count - a.count)
    : undefined;

  // ── Cost Trend (Premium) ──
  const costBuckets = new Map<string, { total: number; count: number }>();
  for (const e of currentEvents) {
    const day = toDateString(getStateField(e, fields.startedAt) || e.timestamp);
    const c = toNumber(getStateField(e, fields.cost));
    if (!day || c <= 0) continue;
    const bucket = costBuckets.get(day) ?? { total: 0, count: 0 };
    bucket.total += c;
    bucket.count++;
    costBuckets.set(day, bucket);
  }
  const costTrend = Array.from(costBuckets.entries())
    .map(([date, b]) => ({ date, totalCost: Number(b.total.toFixed(2)), avgCost: Number((b.total / b.count).toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    headline: {
      total: totalCurrent,
      totalLabel: 'calls handled',
      percentChange,
      periodLabel: 'last 30 days',
    },
    kpis: [
      {
        label: 'Success Rate',
        value: `${successRate}%`,
        trend: successRate >= successPrevious ? 'up' : 'down',
        trendValue: successPrevious > 0 ? `${successRate - successPrevious > 0 ? '+' : ''}${successRate - successPrevious}%` : undefined,
        color: successRate >= 90 ? 'green' : successRate >= 70 ? 'amber' : 'red',
      },
      {
        label: 'Avg Duration',
        value: formatDuration(avgDuration),
        color: 'blue',
      },
      {
        label: 'Total Cost',
        value: formatCost(totalCost),
        unit: 'USD',
        color: 'neutral',
      },
    ],
    trend,
    recentRows,
    endedReasonBreakdown,
    assistantBreakdown,
    sentimentBreakdown: sentimentBreakdown?.length ? sentimentBreakdown : undefined,
    costTrend: costTrend.length > 1 ? costTrend : undefined,
  };
}

// ── Workflow Operations Transform ────────────────────────────

export function transformWorkflowData(events: PortalEvent[], platform: 'n8n' | 'make'): SkeletonData {
  const fields = getWorkflowFieldMapping(platform);

  if (events.length === 0) {
    return {
      headline: { total: 0, totalLabel: 'executions', percentChange: null, periodLabel: 'this month' },
      kpis: [
        { label: 'Success Rate', value: '—', color: 'neutral' },
        { label: 'Avg Runtime', value: '—', color: 'neutral' },
        { label: 'Last Run', value: '—', color: 'neutral' },
      ],
      trend: [],
      recentRows: [],
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const currentEvents = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);
  const previousEvents = events.filter(e => {
    const d = new Date(e.timestamp);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  const totalCurrent = currentEvents.length;
  const percentChange = calculatePercentChange(totalCurrent, previousEvents.length);

  // KPIs
  const successCurrent = currentEvents.filter(e => String(getStateField(e, fields.status)) === fields.statusSuccessValue).length;
  const failedCurrent = totalCurrent - successCurrent;

  const runtimes = currentEvents.map(e => toNumber(getStateField(e, fields.durationMs))).filter(d => d > 0);
  const avgRuntime = runtimes.length > 0 ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length : 0;

  const sortedByTime = [...currentEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const lastRunTime = sortedByTime[0]?.timestamp;
  const lastRunAgo = lastRunTime ? getTimeAgo(new Date(lastRunTime)) : '—';

  // Trend
  const dayBuckets = new Map<string, { count: number; success: number; fail: number }>();
  for (const event of currentEvents) {
    const day = toDateString(getStateField(event, fields.startedAt) || event.timestamp);
    if (!day) continue;
    const bucket = dayBuckets.get(day) ?? { count: 0, success: 0, fail: 0 };
    bucket.count++;
    if (String(getStateField(event, fields.status)) === fields.statusSuccessValue) bucket.success++;
    else bucket.fail++;
    dayBuckets.set(day, bucket);
  }
  const trend = Array.from(dayBuckets.entries())
    .map(([date, b]) => ({ date, count: b.count, successCount: b.success, failCount: b.fail }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent table
  const recentRows: TableRow[] = sortedByTime.slice(0, 15).map(e => ({
    id: String(getStateField(e, fields.executionId) || e.id),
    workflow: String(getStateField(e, fields.workflowName) || 'Unknown'),
    status: String(getStateField(e, fields.status) || 'unknown'),
    duration: formatDuration(toNumber(getStateField(e, fields.durationMs))),
    error: String(getStateField(e, fields.errorMessage) || '—'),
    time: new Date(e.timestamp).toLocaleString(),
  }));

  // Workflow breakdown
  const wfMap = new Map<string, { count: number; success: number; totalDuration: number }>();
  for (const e of currentEvents) {
    const name = String(getStateField(e, fields.workflowName) || 'Unknown');
    const entry = wfMap.get(name) ?? { count: 0, success: 0, totalDuration: 0 };
    entry.count++;
    if (String(getStateField(e, fields.status)) === fields.statusSuccessValue) entry.success++;
    entry.totalDuration += toNumber(getStateField(e, fields.durationMs));
    wfMap.set(name, entry);
  }
  const workflowBreakdown = Array.from(wfMap.entries())
    .map(([name, d]) => ({ 
      name, count: d.count, 
      successRate: d.count > 0 ? Math.round((d.success / d.count) * 100) : 0,
      avgDuration: d.count > 0 ? d.totalDuration / d.count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Error breakdown
  const errorMap = new Map<string, number>();
  for (const e of currentEvents) {
    const err = String(getStateField(e, fields.errorMessage) || '').trim();
    if (err && err !== '—' && err !== 'undefined') {
      const truncated = err.length > 80 ? err.slice(0, 80) + '…' : err;
      errorMap.set(truncated, (errorMap.get(truncated) ?? 0) + 1);
    }
  }
  const errorBreakdown = errorMap.size > 0
    ? Array.from(errorMap.entries()).map(([message, count]) => ({ message, count })).sort((a, b) => b.count - a.count).slice(0, 10)
    : undefined;

  return {
    headline: { total: totalCurrent, totalLabel: 'executions', percentChange, periodLabel: 'last 30 days' },
    kpis: [
      {
        label: 'Failed',
        value: failedCurrent,
        color: failedCurrent === 0 ? 'green' : failedCurrent < 5 ? 'amber' : 'red',
      },
      {
        label: 'Avg Runtime',
        value: formatDuration(avgRuntime),
        color: 'blue',
      },
      {
        label: 'Last Run',
        value: lastRunAgo,
        color: 'neutral',
      },
    ],
    trend,
    recentRows,
    workflowBreakdown,
    errorBreakdown,
  };
}

// ── Dispatcher ───────────────────────────────────────────────

export function transformDataForSkeleton(
  events: PortalEvent[],
  skeletonId: string,
  platformType: string,
): SkeletonData {
  switch (skeletonId) {
    case 'voice-performance':
      return transformVoiceData(events, platformType as 'vapi' | 'retell');
    case 'workflow-operations':
      return transformWorkflowData(events, platformType as 'n8n' | 'make');
    default:
      return transformWorkflowData(events, platformType as 'n8n' | 'make');
  }
}

// ── Utility ──────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatEndedReason(reason: string): string {
  return reason
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Customer Ended Call', 'Customer Hangup')
    .replace('Assistant Ended Call', 'Agent Completed')
    .replace('Silence Timed Out', 'Silence Timeout')
    .replace('Max Duration Reached', 'Time Limit');
}
