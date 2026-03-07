import { getVoiceFieldMapping, getWorkflowFieldMapping } from './fieldMappings';

// ─── Types ───────────────────────────────────────────────────

export interface PortalEvent {
  id: string;
  type: string;
  name?: string | null;
  value?: number | null;
  state: Record<string, unknown> | null;
  labels: Record<string, unknown> | null;
  timestamp: string;
  platform_event_id?: string | null;
  created_at?: string;
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
  // Workflow resource metrics (Phase 2)
  operationsConsumed?: number;
  dataTransferTotal?: number;
  estimatedCost?: number;
  errorNameBreakdown?: { name: string; count: number }[];
  // Combined-specific extras (Phase 3)
  platformComparison?: {
    voice: { count: number; successRate: number; platforms: string[] };
    workflow: { count: number; successRate: number; platforms: string[] };
  };
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Safely read a field from the event's state JSONB.
 * 
 * The events table stores platform-specific data in the `state` column:
 *   - event.state.duration_ms
 *   - event.state.cost
 *   - event.state.ended_reason
 *   - event.state.call_summary
 *   - etc.
 * 
 * The event-level columns are:
 *   - event.type          → 'workflow_execution' | 'message' | 'metric' | etc.
 *   - event.name          → event name (nullable)
 *   - event.value         → numeric value (nullable)
 *   - event.timestamp     → when the event occurred
 *   - event.platform_event_id → original platform ID (e.g., vapi call_id)
 *   - event.labels        → { platform: 'vapi', ... }
 */
export function getStateField(
  event: { state?: Record<string, unknown> | null },
  fieldPath: string
): unknown {
  if (!event.state) return undefined;
  
  // Support dot-notation: 'cost_breakdown.total'
  const parts = fieldPath.split('.');
  let current: unknown = event.state;
  
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Get the platform from an event.
 * The platform is stored in event.labels.platform
 */
export function getEventPlatform(
  event: { state?: Record<string, unknown> | null; labels?: Record<string, unknown> | null }
): string | undefined {
  // state.platform is set by ALL import routes (retell, vapi, make, n8n)
  // labels.platformType is set by make/n8n imports
  return (event.state?.platform as string)
    || (event.labels?.platformType as string)
    || (event.labels?.platform as string)
    || undefined;
}

/**
 * Get the status from an event's state JSONB.
 * Import routes store normalized status in state.status
 */
export function getEventStatus(
  event: { state?: Record<string, unknown> | null }
): string {
  return (event.state?.status as string) ?? 'unknown';
}

/**
 * Get workflow/assistant name from state.
 * Stored as state.workflow_name by import routes.
 */
export function getEventWorkflowName(
  event: { state?: Record<string, unknown> | null }
): string {
  return (event.state?.workflow_name as string) ?? 'Unknown';
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

  // ── Recent Calls Table — pass ALL state fields for enriched display ──
  const recentRows: TableRow[] = currentEvents
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)
    .map(e => {
      const base: TableRow = {
        id: String(getStateField(e, fields.callId) || e.id),
        assistant: String(getStateField(e, fields.assistantName) || 'Unknown'),
        status: String(getStateField(e, fields.status) || 'unknown'),
        duration: formatDuration(toNumber(getStateField(e, fields.durationMs))),
        cost: formatCost(toNumber(getStateField(e, fields.cost))),
        endedReason: String(getStateField(e, fields.endedReason) || '—'),
        sentiment: String(getStateField(e, fields.sentiment) || '—'),
        time: new Date(e.timestamp).toLocaleString(),
        transcript: String(getStateField(e, fields.transcript) || ''),
        callSummary: String(getStateField(e, fields.callSummary) || ''),
      };
      if (e.state && typeof e.state === 'object') {
        for (const [key, value] of Object.entries(e.state)) {
          if (!(key in base) && value !== undefined && value !== null) {
            base[key] = value;
          }
        }
      }
      return base;
    });

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

  // Recent table — pass ALL state fields so skeleton can show enriched data
  const recentRows: TableRow[] = sortedByTime.slice(0, 15).map(e => {
    const base: TableRow = {
      id: String(getStateField(e, fields.executionId) || e.id),
      workflow: String(getStateField(e, fields.workflowName) || 'Unknown'),
      status: String(getStateField(e, fields.status) || 'unknown'),
      duration: formatDuration(toNumber(getStateField(e, fields.durationMs))),
      error: String(getStateField(e, fields.errorMessage) || '—'),
      time: new Date(e.timestamp).toLocaleString(),
    };
    if (e.state && typeof e.state === 'object') {
      for (const [key, value] of Object.entries(e.state)) {
        if (!(key in base) && value !== undefined && value !== null) {
          base[key] = value;
        }
      }
    }
    return base;
  });

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

  // Resource metrics aggregation (from Phase 0 enriched state fields)
  let operationsConsumed = 0;
  let dataTransferTotal = 0;
  let totalCenticredits = 0;

  for (const e of currentEvents) {
    operationsConsumed += toNumber(getStateField(e, fields.operationsUsed));
    dataTransferTotal += toNumber(getStateField(e, 'data_transfer_bytes'));
    totalCenticredits += toNumber(getStateField(e, 'centicredits'));
  }

  const estimatedCost = totalCenticredits > 0 ? totalCenticredits / 100 : undefined;

  // Error name breakdown (distinct from error message breakdown)
  const errorNameMap = new Map<string, number>();
  for (const e of currentEvents) {
    const errName = String(getStateField(e, 'error_name') || '').trim();
    if (errName && errName !== 'undefined') {
      errorNameMap.set(errName, (errorNameMap.get(errName) ?? 0) + 1);
    }
  }
  const errorNameBreakdown = errorNameMap.size > 0
    ? Array.from(errorNameMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
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
    // Phase 2 additions
    operationsConsumed: operationsConsumed > 0 ? operationsConsumed : undefined,
    dataTransferTotal: dataTransferTotal > 0 ? dataTransferTotal : undefined,
    estimatedCost,
    errorNameBreakdown,
  };
}

export function transformROIData(events: PortalEvent[], platformType: string): SkeletonData {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const currentEvents = events.filter((e) => new Date(e.timestamp) >= thirtyDaysAgo);
  const previousEvents = events.filter((e) => {
    const d = new Date(e.timestamp);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  const avgMinutes = platformType === 'vapi' || platformType === 'retell' ? 15 : 30;
  const tasks = currentEvents.length;
  const hoursSaved = (tasks * avgMinutes) / 60;
  const estSavings = hoursSaved * 35;

  const totalAutomationCost = currentEvents.reduce((acc, event) => acc + toNumber(getStateField(event, 'cost') || event.value), 0);
  const costPerTask = tasks > 0 ? totalAutomationCost / tasks : 0;

  const previousTasks = previousEvents.length;
  const previousHours = (previousTasks * avgMinutes) / 60;
  const previousSavings = previousHours * 35;
  const percentChange = calculatePercentChange(estSavings, previousSavings);

  const daySavings = new Map<string, number>();
  for (const event of currentEvents) {
    const day = toDateString(event.timestamp);
    if (!day) continue;
    daySavings.set(day, (daySavings.get(day) ?? 0) + (avgMinutes / 60) * 35);
  }

  let running = 0;
  const trend = Array.from(daySavings.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, savings]) => {
      running += savings;
      return { date, count: Number(running.toFixed(2)) };
    });

  const typeBreakdown = new Map<string, number>();
  for (const event of currentEvents) {
    const type = event.type || getEventPlatform(event) || 'event';
    typeBreakdown.set(type, (typeBreakdown.get(type) ?? 0) + 1);
  }

  const recentRows: TableRow[] = Array.from(typeBreakdown.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const rowHours = (count * avgMinutes) / 60;
      const rowSavings = rowHours * 35;
      return {
        id: type,
        type,
        count,
        estSavings: formatCost(rowSavings),
        costPerTask: formatCost(costPerTask),
      };
    });

  return {
    headline: {
      total: Math.round(estSavings),
      totalLabel: 'saved',
      percentChange,
      periodLabel: 'last 30 days',
    },
    kpis: [
      { label: 'Tasks Done', value: tasks.toLocaleString(), color: 'blue' },
      { label: 'Hours Saved', value: `${hoursSaved.toFixed(0)} hrs`, color: 'green' },
      { label: 'Cost per Task', value: formatCost(costPerTask), color: 'neutral' },
    ],
    trend,
    recentRows,
  };
}

export function transformCombinedData(events: PortalEvent[], platformType: string): SkeletonData {
  void platformType;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const currentEvents = events.filter((e) => new Date(e.timestamp) >= thirtyDaysAgo);
  const previousEvents = events.filter((e) => {
    const d = new Date(e.timestamp);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  // Split by platform category
  const voiceEvents = currentEvents.filter((e) => {
    const p = getEventPlatform(e);
    return p === 'vapi' || p === 'retell';
  });
  const workflowEvents = currentEvents.filter((e) => {
    const p = getEventPlatform(e);
    return p === 'make' || p === 'n8n';
  });

  // Overall metrics
  const totalOps = currentEvents.length;
  const successCount = currentEvents.filter((e) => getEventStatus(e) === 'success').length;
  const successRate = totalOps > 0 ? Math.round((successCount / totalOps) * 100) : 0;
  const failedCount = totalOps - successCount;

  const durations = currentEvents.map((e) => toNumber(getStateField(e, 'duration_ms'))).filter((d) => d > 0);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const totalCost = currentEvents.reduce((acc, e) => acc + toNumber(getStateField(e, 'cost') || e.value), 0);

  // Per-platform success rates
  const voiceSuccess = voiceEvents.length > 0
    ? Math.round((voiceEvents.filter((e) => getEventStatus(e) === 'success').length / voiceEvents.length) * 100)
    : 0;
  const workflowSuccess = workflowEvents.length > 0
    ? Math.round((workflowEvents.filter((e) => getEventStatus(e) === 'success').length / workflowEvents.length) * 100)
    : 0;

  // Trend (daily buckets with success/fail)
  const dayBuckets = new Map<string, { count: number; success: number; fail: number }>();
  for (const event of currentEvents) {
    const day = toDateString(event.timestamp);
    if (!day) continue;
    const bucket = dayBuckets.get(day) ?? { count: 0, success: 0, fail: 0 };
    bucket.count++;
    if (getEventStatus(event) === 'success') bucket.success++;
    else bucket.fail++;
    dayBuckets.set(day, bucket);
  }
  const trend = Array.from(dayBuckets.entries())
    .map(([date, b]) => ({ date, count: b.count, successCount: b.success, failCount: b.fail }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent rows with platform badge
  const recentRows = [...currentEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20)
    .map((event) => {
      const platform = getEventPlatform(event) || 'unknown';
      const base: TableRow = {
        id: event.id,
        name: getEventWorkflowName(event),
        status: getEventStatus(event),
        platform,
        platformCategory: (platform === 'vapi' || platform === 'retell') ? 'voice' : 'workflow',
        type: event.type,
        duration: formatDuration(toNumber(getStateField(event, 'duration_ms'))),
        cost: formatCost(toNumber(getStateField(event, 'cost'))),
        time: new Date(event.timestamp).toLocaleString(),
      };
      if (event.state && typeof event.state === 'object') {
        for (const [key, value] of Object.entries(event.state)) {
          if (!(key in base) && value !== undefined && value !== null) {
            base[key] = value;
          }
        }
      }
      return base;
    });

  return {
    headline: {
      total: totalOps,
      totalLabel: 'total operations',
      percentChange: calculatePercentChange(totalOps, previousEvents.length),
      periodLabel: 'last 30 days',
    },
    kpis: [
      { label: 'Success Rate', value: `${successRate}%`, color: successRate >= 90 ? 'green' : successRate >= 70 ? 'amber' : 'red' },
      { label: 'Avg Duration', value: avgDuration > 0 ? formatDuration(avgDuration) : '—', color: 'blue' },
      { label: 'Failed', value: failedCount, color: failedCount === 0 ? 'green' : 'red' },
      { label: 'Total Cost', value: formatCost(totalCost), color: 'neutral' },
    ],
    trend,
    recentRows,
    platformComparison: {
      voice: { count: voiceEvents.length, successRate: voiceSuccess, platforms: [...new Set(voiceEvents.map((e) => getEventPlatform(e) || 'unknown'))] },
      workflow: { count: workflowEvents.length, successRate: workflowSuccess, platforms: [...new Set(workflowEvents.map((e) => getEventPlatform(e) || 'unknown'))] },
    },
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
    case 'roi-summary':
      return transformROIData(events, platformType);
    case 'combined-overview':
      return transformCombinedData(events, platformType);
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
