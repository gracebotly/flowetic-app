// mastra/lib/layout/dataSignals.ts
//
// Computes aggregate data signals from generateMapping's fieldAnalysis output.
// These signals drive skeleton selection (skeletonSelector.ts) and BM25
// query construction for design pattern retrieval (Phase 3).
//
// This file has NO external dependencies — it receives classified field data
// and returns computed signals. Pure functions, trivially testable.

import type { DataShapeSignals } from './skeletonSelector';

// ============================================================================
// Input Types (from generateMapping.ts output)
// ============================================================================

/**
 * Single classified field from generateMapping.
 * Matches the fieldAnalysis array in generateMapping's output schema.
 */
export interface ClassifiedFieldInput {
  name: string;
  type: string;
  /** Field shape from generateMapping's classifyField() */
  shape: string; // 'id' | 'status' | 'binary' | 'timestamp' | 'duration' | 'money' | 'rate' | 'label' | 'high_cardinality_text' | 'long_text' | 'numeric' | 'unknown'
  /** Component recommendation from generateMapping */
  component: string; // 'MetricCard' | 'TimeseriesChart' | 'PieChart' | 'BarChart' | 'DataTable'
  /** Aggregation type */
  aggregation: string;
  /** Role in the dashboard story */
  role: string; // 'hero' | 'supporting' | 'trend' | 'breakdown' | 'detail'
  uniqueValues: number;
  totalRows: number;
  skip: boolean;
  skipReason?: string;
}

/**
 * Optional event statistics for density calculation.
 * If available from getEventStats or analyzeSchema, enhances density signals.
 */
export interface EventStatsInput {
  /** Total events in the time window */
  totalEvents?: number;
  /** Events per hour (computed from time range) */
  eventsPerHour?: number;
  /** Error rate (0-1) */
  errorRate?: number;
  /** Time span in hours of the data */
  timeSpanHours?: number;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Full computed data signals including BM25 query and data story.
 * Extends DataShapeSignals (used by skeletonSelector) with additional context.
 */
export interface DataSignals extends DataShapeSignals {
  /** Narrative assessment of data health */
  dataStory: 'healthy' | 'warning' | 'critical' | 'unknown';
  /** BM25 search query built from signals (for Phase 3 design pattern retrieval) */
  layoutQuery: string;
  /** Summary string for logs */
  summary: string;
}

// ============================================================================
// Computation
// ============================================================================

/** Shapes that render well in tables (not as standalone charts/cards) */
const TABLE_SUITABLE_SHAPES = new Set([
  'detail',
  'label',
  'long_text',
  'high_cardinality_text',
  'unknown',
]);

/** Shapes that are categorical (useful for breakdown charts) */
const CATEGORICAL_SHAPES = new Set([
  'status',
  'binary',
  'label',
]);

/**
 * Compute data signals from field analysis.
 *
 * @param fieldAnalysis - Classified fields from generateMapping output
 * @param mappings - Field mappings (used for field count validation)
 * @param eventStats - Optional event statistics for density signals
 * @returns DataSignals object for skeleton selection and BM25 query
 */
export function computeDataSignals(
  fieldAnalysis: ClassifiedFieldInput[],
  mappings?: Record<string, string>,
  eventStats?: EventStatsInput,
): DataSignals {
  const active = fieldAnalysis.filter(f => !f.skip);
  const fieldCount = active.length;

  // ── Timestamp / Timeseries detection ──────────────────────────────
  const hasTimestamp = active.some(
    f => f.shape === 'timestamp' && f.uniqueValues >= 5,
  );
  const hasTimeSeries = active.some(
    f => f.role === 'trend' && f.component === 'TimeseriesChart',
  );

  // ── Breakdown detection ───────────────────────────────────────────
  const hasBreakdown = active.some(f => f.role === 'breakdown');

  // ── Status / Categorical field counts ─────────────────────────────
  const statusFields = active.filter(
    f => f.shape === 'status' || f.shape === 'binary',
  ).length;

  const categoricalFields = active.filter(f => {
    if (!CATEGORICAL_SHAPES.has(f.shape)) return false;
    // Must have 2-20 unique values to be meaningfully categorical
    return f.uniqueValues >= 2 && f.uniqueValues <= 20;
  }).length;

  // ── Table suitability ratio ───────────────────────────────────────
  // What fraction of fields are best shown in a table (vs chart/card)?
  const tableSuitableCount = active.filter(f =>
    TABLE_SUITABLE_SHAPES.has(f.role) ||
    f.shape === 'high_cardinality_text' ||
    f.shape === 'long_text' ||
    (f.shape === 'label' && f.uniqueValues > 10),
  ).length;
  const tableSuitableRatio = fieldCount > 0
    ? tableSuitableCount / fieldCount
    : 0;

  // ── Event density ─────────────────────────────────────────────────
  let eventDensity: 'low' | 'medium' | 'high' = 'medium';
  if (eventStats?.eventsPerHour !== undefined) {
    if (eventStats.eventsPerHour > 100) eventDensity = 'high';
    else if (eventStats.eventsPerHour < 5) eventDensity = 'low';
  } else if (eventStats?.totalEvents !== undefined) {
    // Fallback: estimate from total events
    if (eventStats.totalEvents > 1000) eventDensity = 'high';
    else if (eventStats.totalEvents < 50) eventDensity = 'low';
  } else {
    // No event stats — infer from field cardinality
    const maxCardinality = active.reduce(
      (max, f) => Math.max(max, f.uniqueValues), 0,
    );
    if (maxCardinality > 500) eventDensity = 'high';
    else if (maxCardinality < 10) eventDensity = 'low';
  }

  // ── Data story (narrative health assessment) ──────────────────────
  // Priority 1: Use explicit errorRate from eventStats if available
  // Priority 2: Infer from field shapes and names (heuristic)
  let dataStory: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';
  if (eventStats?.errorRate !== undefined) {
    if (eventStats.errorRate < 0.05) dataStory = 'healthy';
    else if (eventStats.errorRate < 0.20) dataStory = 'warning';
    else dataStory = 'critical';
  } else {
    // Heuristic: infer data story from field characteristics
    const hasErrorField = active.some(
      f => /error|fail|exception|fault/i.test(f.name),
    );
    const hasStatusField = active.some(
      f => f.shape === 'status' || f.shape === 'binary',
    );
    const hasDurationField = active.some(
      f => f.shape === 'duration',
    );
    const hasMoneyField = active.some(
      f => f.shape === 'money' || f.shape === 'rate',
    );

    if (hasErrorField && hasStatusField) {
      // Error monitoring pattern (e.g., n8n workflow executions with error_message + status)
      dataStory = 'warning';
    } else if (hasStatusField && hasDurationField) {
      // Operational monitoring (status + duration = performance tracking)
      dataStory = 'healthy';
    } else if (hasMoneyField) {
      // Financial/ROI tracking
      dataStory = 'healthy';
    } else if (hasTimeSeries && statusFields > 0) {
      // Time-series with status = operational monitoring
      dataStory = 'healthy';
    } else if (hasTimeSeries) {
      // Pure time-series without status = trend analysis (neutral)
      dataStory = 'healthy';
    }
    // else: stays 'unknown' — genuinely unclassifiable data
  }

  // ── BM25 layout query ─────────────────────────────────────────────
  const layoutQuery = buildLayoutQuery(
    fieldCount,
    hasTimeSeries,
    hasBreakdown,
    statusFields,
    categoricalFields,
    eventDensity,
    dataStory,
  );

  // ── Summary for logging ───────────────────────────────────────────
  const summary = [
    `fields=${fieldCount}`,
    `ts=${hasTimeSeries ? 'yes' : 'no'}`,
    `breakdown=${hasBreakdown ? 'yes' : 'no'}`,
    `status=${statusFields}`,
    `categorical=${categoricalFields}`,
    `tableRatio=${tableSuitableRatio.toFixed(2)}`,
    `density=${eventDensity}`,
    `story=${dataStory}`,
  ].join(', ');

  return {
    fieldCount,
    hasTimestamp,
    hasTimeSeries,
    hasBreakdown,
    statusFields,
    categoricalFields,
    tableSuitableRatio,
    eventDensity,
    dataStory,
    layoutQuery,
    summary,
  };
}

// ============================================================================
// BM25 Query Builder
// ============================================================================

/**
 * Build a BM25 search query from data signals.
 *
 * The query is used by Phase 3's retrieveDesignPatternsStep to search
 * the 247 patterns in workspace/skills/ui-ux-pro-max/data/ CSVs:
 *   - styles.csv (67 UI styles)
 *   - typography.csv (57 font pairings)
 *   - charts.csv (25 chart types)
 *   - products.csv (50+ industry patterns)
 *   - ui-reasoning.csv (layout logic by industry)
 *   - ux-guidelines.csv (98 best practices)
 *
 * The query combines density terms + component terms + story terms
 * to surface the most relevant design patterns for this specific dashboard.
 */
export function buildLayoutQuery(
  fieldCount: number,
  hasTimeSeries: boolean,
  hasBreakdown: boolean,
  statusFields: number,
  categoricalFields: number,
  eventDensity: 'low' | 'medium' | 'high',
  dataStory: 'healthy' | 'warning' | 'critical' | 'unknown',
): string {
  const terms: string[] = [];

  // ── Density terms ─────────────────────────────────────────────────
  if (fieldCount <= 5) {
    terms.push('minimal', 'executive', 'KPI-focused', 'hero');
  } else if (fieldCount <= 12) {
    terms.push('balanced', 'analytical', 'multi-chart', 'breakdown');
  } else {
    terms.push('data-heavy', 'table-dominant', 'filterable', 'sortable');
  }

  // ── Component terms ───────────────────────────────────────────────
  if (hasTimeSeries) {
    terms.push('time-series', 'trends', 'temporal', 'line-chart');
  }
  if (hasBreakdown) {
    terms.push('distribution', 'pie-chart', 'bar-chart', 'categorical');
  }
  if (statusFields > 0) {
    terms.push('status-indicators', 'health-monitoring', 'status-distribution');
  }
  if (categoricalFields >= 3) {
    terms.push('multi-dimensional', 'comparison', 'segmentation');
  }

  // ── Event density terms ───────────────────────────────────────────
  if (eventDensity === 'high') {
    terms.push('real-time', 'high-volume', 'streaming', 'event-feed');
  } else if (eventDensity === 'low') {
    terms.push('summary', 'snapshot', 'overview');
  }

  // ── Story terms ───────────────────────────────────────────────────
  switch (dataStory) {
    case 'healthy':
      terms.push('success', 'performance', 'growth');
      break;
    case 'warning':
      terms.push('attention', 'warning', 'degradation');
      break;
    case 'critical':
      terms.push('critical', 'alert', 'error-tracking', 'incident');
      break;
    case 'unknown':
      terms.push('general', 'dashboard', 'monitoring');
      break;
  }

  return terms.join(' ');
}
