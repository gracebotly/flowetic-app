// mastra/lib/layout/skeletonSelector.ts
//
// Deterministic skeleton selection — no LLM, no randomness.
// Same inputs always produce the same skeleton.
//
// Priority order:
//   0. Explicit UI type (landing-page, form-wizard, etc.)
//   1. Client-facing mode → Storyboard (always)
//   2. Operational monitoring signals (status + timestamp + high density)
//   3. High categorical diversity (3+ categories, 6+ fields, breakdown data)
//   4. Table-heavy data (>60% table-suitable ratio, or >40% + >20 fields)
//   5. Default → Executive Overview (clean, professional)

import { SkeletonId } from './skeletons';

// ============================================================================
// Selection Context — what the selector needs to make a decision
// ============================================================================

/**
 * UI type — explicitly set by the agent/journey for non-dashboard interfaces.
 * When set, this overrides all data-shape-based selection.
 */
export type UIType =
  | 'dashboard'
  | 'landing-page'
  | 'form-wizard'
  | 'results-display'
  | 'admin-crud'
  | 'settings'
  | 'auth';

/**
 * Data shape signals computed from field analysis.
 * See `computeDataSignals()` in `dataSignals.ts`.
 */
export interface DataShapeSignals {
  /** Total number of active (non-skipped) fields */
  fieldCount: number;
  /** Whether any timestamp field with ≥5 unique values exists (real timeseries) */
  hasTimestamp: boolean;
  /** Whether any timeseries trend field exists (TimeseriesChart-worthy) */
  hasTimeSeries: boolean;
  /** Whether any breakdown field exists (PieChart/BarChart-worthy) */
  hasBreakdown: boolean;
  /** Number of status/categorical fields */
  statusFields: number;
  /** Number of categorical fields (2-20 unique values, non-ID) */
  categoricalFields: number;
  /** Ratio of fields suitable for table display (detail/label/long_text/high_cardinality) */
  tableSuitableRatio: number;
  /** Event density classification */
  eventDensity: 'low' | 'medium' | 'high';
  /** Whether data should be displayed as metrics, browsable records, or both */
  dataDisplayMode: 'metrics' | 'records' | 'hybrid';
  /** Fields classified as rich_text shape */
  richTextFields: string[];
  /** Detected field groups with null rate metadata */
  fieldGroups: Array<{
    prefix: string;
    fields: string[];
    avgNullRate: number;
  }>;
  /** Fields with nullRate > 0.5 */
  sparseFields: string[];
}

/**
 * Full context needed for skeleton selection.
 */
export interface SelectionContext {
  /** Explicit UI type (overrides data-shape selection) */
  uiType: UIType;
  /** Computed data shape signals */
  dataShape: DataShapeSignals;
  dataDisplayMode?: 'metrics' | 'records' | 'hybrid';
  /** Dashboard mode: internal (agency) or client-facing (customer portal) */
  mode: 'internal' | 'client-facing';
  /** Platform type (vapi, n8n, make, etc.) — informational, not used in selection */
  platform: string;
  /** User intent text (e.g., "monitor health", "analyze trends", "compare performance") */
  intent: string;
}

// ============================================================================
// Skeleton Capacity Requirements
// ============================================================================

/**
 * Minimum data requirements for a skeleton to render well.
 * If the data can't fill the skeleton, we downgrade to the fallback.
 * This prevents the post-process expansion from destroying layouts
 * when half the sections get skipped due to insufficient data.
 */
interface SkeletonCapacity {
  /** Minimum fields that produce charts/cards (not table-only fields) */
  minChartableFields: number;
  /** Minimum total active (non-skipped) fields */
  minActiveFields: number;
  /** Minimum distinct data roles needed (hero, trend, breakdown) */
  minDistinctRoles: number;
  /** Skeleton to use if this one can't be filled */
  fallback: SkeletonId;
}

const SKELETON_CAPACITY: Record<string, SkeletonCapacity> = {
  'operational-monitoring': {
    minChartableFields: 5,   // 3 KPIs + trend chart + breakdown + feed
    minActiveFields: 6,
    minDistinctRoles: 3,     // hero + trend + breakdown
    fallback: 'executive-overview',
  },
  'analytical-breakdown': {
    minChartableFields: 4,
    minActiveFields: 6,
    minDistinctRoles: 2,     // breakdown + at least one other
    fallback: 'executive-overview',
  },
  'table-first': {
    minChartableFields: 2,
    minActiveFields: 8,
    minDistinctRoles: 1,
    fallback: 'executive-overview',
  },
  'storyboard-insight': {
    minChartableFields: 3,
    minActiveFields: 4,
    minDistinctRoles: 2,
    fallback: 'executive-overview',
  },
  'executive-overview': {
    minChartableFields: 2,   // very forgiving — works with sparse data
    minActiveFields: 3,
    minDistinctRoles: 1,
    fallback: 'executive-overview', // it IS the final fallback
  },
  'record-browser': {
    minChartableFields: 1,
    minActiveFields: 3,
    minDistinctRoles: 1,
    fallback: 'record-browser',
  },
};

/**
 * Validate that the selected skeleton can actually be filled by the available data.
 * If not, recursively downgrade to a simpler skeleton.
 *
 * This is the key architectural fix: the priority waterfall asks "what KIND of data?"
 * but never asked "is there ENOUGH data?" — causing complex skeletons to be selected
 * for sparse datasets, leading to half-empty layouts that the post-process expansion
 * then destroys by blowing everything to w:12.
 */
function validateSkeletonCapacity(
  candidate: SkeletonId,
  dataShape: DataShapeSignals,
): SkeletonId {
  const capacity = SKELETON_CAPACITY[candidate];
  if (!capacity) return candidate; // product/admin skeletons — no capacity check needed

  // Count chartable fields (fields that produce charts/cards, not just table rows)
  const chartableFields = Math.max(
    1,
    dataShape.fieldCount - Math.floor(dataShape.fieldCount * dataShape.tableSuitableRatio),
  );

  // Count distinct data roles
  let distinctRoles = 0;
  if (dataShape.fieldCount > 0) distinctRoles++;                                    // hero (any countable field)
  if (dataShape.hasTimeSeries || dataShape.hasTimestamp) distinctRoles++;            // trend
  if (dataShape.hasBreakdown || dataShape.categoricalFields > 0) distinctRoles++;   // breakdown

  const meetsChartable = chartableFields >= capacity.minChartableFields;
  const meetsActive = dataShape.fieldCount >= capacity.minActiveFields;
  const meetsRoles = distinctRoles >= capacity.minDistinctRoles;

  if (meetsChartable && meetsActive && meetsRoles) {
    return candidate; // ✅ Data can fill this skeleton
  }

  // ❌ Data can't fill this skeleton — downgrade
  console.log(
    `[selectSkeleton] ⚠️ Capacity gate: "${candidate}" requires ` +
    `${capacity.minChartableFields} chartable / ${capacity.minActiveFields} active / ${capacity.minDistinctRoles} roles, ` +
    `but data has ${chartableFields} / ${dataShape.fieldCount} / ${distinctRoles}. ` +
    `Downgrading → "${capacity.fallback}".`,
  );

  if (capacity.fallback !== candidate) {
    return validateSkeletonCapacity(capacity.fallback, dataShape);
  }
  return candidate;
}

// ============================================================================
// Selection Function
// ============================================================================

/**
 * Deterministically select a layout skeleton based on context.
 *
 * This function is the ONLY place skeleton selection happens.
 * It uses a strict priority waterfall — first matching rule wins.
 * After selection, a capacity gate validates that the data can actually
 * fill the chosen skeleton. If not, it downgrades gracefully.
 *
 * @returns SkeletonId — one of the 11 skeleton identifiers
 */
export function selectSkeleton(context: SelectionContext): SkeletonId {
  const candidate = selectSkeletonCandidate(context);

  // Capacity gate: can the data actually fill this skeleton?
  // Product/admin skeletons skip this check (not data-driven).
  const skipCapacityCheck = [
    'saas-landing-page', 'workflow-input-form', 'results-display',
    'admin-crud-panel', 'settings-dashboard', 'authentication-flow',
  ].includes(candidate);

  if (skipCapacityCheck) return candidate;

  const validated = validateSkeletonCapacity(candidate, context.dataShape);
  if (validated !== candidate) {
    console.log(
      `[selectSkeleton] Skeleton changed: "${candidate}" → "${validated}" (capacity gate)`,
    );
  }
  return validated;
}

/**
 * Priority waterfall — picks the ideal skeleton based on data semantics.
 * This is the "what KIND of data?" question.
 */
function selectSkeletonCandidate(context: SelectionContext): SkeletonId {
  // ── PRIORITY 0: Explicit UI type (product pages + admin) ──────────
  if (context.uiType === 'landing-page') return 'saas-landing-page';
  if (context.uiType === 'form-wizard') return 'workflow-input-form';
  if (context.uiType === 'results-display') return 'results-display';
  if (context.uiType === 'admin-crud') return 'admin-crud-panel';
  if (context.uiType === 'settings') return 'settings-dashboard';
  if (context.uiType === 'auth') return 'authentication-flow';

  // ── PRIORITY 0.5: Record-oriented data → Record Browser ────────
  // If the data pipeline detected rich text, field groups with mixed nulls,
  // or hybrid data shapes, route to the record-browser skeleton.
  // This fires BEFORE dashboard scoring so record-oriented data doesn't
  // get forced into analytics-oriented skeletons.
  const displayMode = context.dataShape?.dataDisplayMode
    ?? context.dataDisplayMode
    ?? 'metrics';

  if (
    (displayMode === 'records' || displayMode === 'hybrid') &&
    (context.uiType === 'dashboard' || !context.uiType)
  ) {
    return 'record-browser';
  }

  // ── PRIORITY 1: Client-facing mode → Storyboard (always) ─────────
  if (context.mode === 'client-facing') return 'storyboard-insight';

  // ── PRIORITY 2: Operational monitoring signals ────────────────────
  const intentLower = context.intent.toLowerCase();
  // Tightened: only match genuine operational monitoring intent.
  // Old list included 'pipeline', 'dashboard', 'workflow', 'track' which match
  // basically every request and caused operational-monitoring to be selected
  // for sparse datasets that can't fill its 8-section layout.
  const hasMonitoringIntent = intentLower.includes('monitor') ||
    intentLower.includes('health check') ||
    intentLower.includes('real-time') ||
    intentLower.includes('realtime') ||
    intentLower.includes('uptime') ||
    intentLower.includes('devops') ||
    intentLower.includes('observability') ||
    intentLower.includes('incident') ||
    intentLower.includes('ops status');
  if (
    context.dataShape.hasTimestamp &&
    context.dataShape.statusFields > 0 &&
    (
      context.dataShape.eventDensity === 'high' ||
      (context.dataShape.hasTimeSeries && (context.dataShape.eventDensity === 'medium' || hasMonitoringIntent))
    )
  ) {
    return 'operational-monitoring';
  }

  // ── PRIORITY 3: High categorical diversity (analytical data) ──────
  // Moved ABOVE table-first. Data with rich categorical fields (source,
  // industry, country, status) should get analytical layouts, not tables.
  // Enriched n8n workflows often have 17-25 fields but are analytically
  // rich — they need breakdown charts, not just a giant data table.
  if (
    context.dataShape.categoricalFields >= 2 &&
    context.dataShape.fieldCount >= 6 &&
    context.dataShape.hasBreakdown &&
    (
      intentLower.includes('analyze') || intentLower.includes('compare') ||
      intentLower.includes('breakdown') || intentLower.includes('segment') ||
      context.dataShape.categoricalFields >= 3 ||
      // Strong analytical signal: many categories relative to total fields
      (context.dataShape.categoricalFields >= 4 && context.dataShape.tableSuitableRatio < 0.5)
    )
  ) {
    return 'analytical-breakdown';
  }

  // ── PRIORITY 4: Table-heavy data ──────────────────────────────────
  // Tightened: requires genuinely table-suitable data shape, not just
  // high field count. Modern n8n workflows routinely have 17-25 fields
  // but most are chartable (scores, budgets, categories), not table-only.
  // Old condition: `tableSuitableRatio > 0.6 || fieldCount > 15`
  // New condition: tableSuitableRatio must be dominant (>0.6), OR
  //   both moderately table-like (>0.4) AND field-rich (>20).
  if (
    context.dataShape.tableSuitableRatio > 0.6 ||
    (context.dataShape.tableSuitableRatio > 0.4 && context.dataShape.fieldCount > 20)
  ) {
    return 'table-first';
  }

  // ── PRIORITY 5: Default → Executive Overview ──────────────────────
  return 'executive-overview';
}

// ============================================================================
// Selection Reason (Observability)
// ============================================================================

/**
 * Human-readable explanation of why a skeleton was selected.
 * Use this in logs and spec metadata for debugging.
 */
export function getSelectionReason(context: SelectionContext, selectedId: SkeletonId): string {
  switch (selectedId) {
    case 'saas-landing-page':
    case 'workflow-input-form':
    case 'results-display':
    case 'admin-crud-panel':
    case 'settings-dashboard':
    case 'authentication-flow':
      return `Explicit UI type: "${context.uiType}" → ${selectedId}`;

    case 'storyboard-insight':
      return 'Client-facing mode → narrative storyboard layout';

    case 'record-browser':
      return `Record-oriented data: displayMode=${context.dataShape.dataDisplayMode}, richText=${context.dataShape.richTextFields.length}, groups=${context.dataShape.fieldGroups.length}`;

    case 'operational-monitoring':
      return `Operational signals: hasTimestamp=${context.dataShape.hasTimestamp}, statusFields=${context.dataShape.statusFields}, hasTimeSeries=${context.dataShape.hasTimeSeries}, eventDensity=${context.dataShape.eventDensity}`;

    case 'analytical-breakdown':
      return `Analytical: categoricalFields=${context.dataShape.categoricalFields}, fieldCount=${context.dataShape.fieldCount}, hasBreakdown=${context.dataShape.hasBreakdown}, tableSuitableRatio=${context.dataShape.tableSuitableRatio.toFixed(2)}`;

    case 'table-first':
      return `Table-heavy: tableSuitableRatio=${context.dataShape.tableSuitableRatio.toFixed(2)}, fieldCount=${context.dataShape.fieldCount}`;

    case 'executive-overview':
      return `Executive overview: clean layout for ${context.dataShape.fieldCount} fields (${context.dataShape.eventDensity} density)`;

    default:
      return `Selected: ${selectedId}`;
  }
}
