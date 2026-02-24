// mastra/lib/layout/skeletonSelector.ts
//
// Deterministic skeleton selection — no LLM, no randomness.
// Same inputs always produce the same skeleton.
//
// Priority order:
//   0. Explicit UI type (landing-page, form-wizard, etc.)
//   1. Client-facing mode → Storyboard (always)
//   2. Operational monitoring signals (status + timestamp + high density)
//   3. Table-heavy data (>60% table-suitable or >15 fields)
//   4. High categorical diversity (3+ categories, 8+ fields, analyze/compare intent)
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
}

/**
 * Full context needed for skeleton selection.
 */
export interface SelectionContext {
  /** Explicit UI type (overrides data-shape selection) */
  uiType: UIType;
  /** Computed data shape signals */
  dataShape: DataShapeSignals;
  /** Dashboard mode: internal (agency) or client-facing (customer portal) */
  mode: 'internal' | 'client-facing';
  /** Platform type (vapi, n8n, make, etc.) — informational, not used in selection */
  platform: string;
  /** User intent text (e.g., "monitor health", "analyze trends", "compare performance") */
  intent: string;
}

// ============================================================================
// Selection Function
// ============================================================================

/**
 * Deterministically select a layout skeleton based on context.
 *
 * This function is the ONLY place skeleton selection happens.
 * It uses a strict priority waterfall — first matching rule wins.
 *
 * @returns SkeletonId — one of the 11 skeleton identifiers
 */
export function selectSkeleton(context: SelectionContext): SkeletonId {
  // ── PRIORITY 0: Explicit UI type (product pages + admin) ──────────
  if (context.uiType === 'landing-page') return 'saas-landing-page';
  if (context.uiType === 'form-wizard') return 'workflow-input-form';
  if (context.uiType === 'results-display') return 'results-display';
  if (context.uiType === 'admin-crud') return 'admin-crud-panel';
  if (context.uiType === 'settings') return 'settings-dashboard';
  if (context.uiType === 'auth') return 'authentication-flow';

  // ── PRIORITY 1: Client-facing mode → Storyboard (always) ─────────
  if (context.mode === 'client-facing') return 'storyboard-insight';

  // ── PRIORITY 2: Operational monitoring signals ────────────────────
  const intentLower = context.intent.toLowerCase();
  if (
    context.dataShape.hasTimestamp &&
    context.dataShape.statusFields > 0 &&
    context.dataShape.eventDensity === 'high' &&
    (intentLower.includes('monitor') || intentLower.includes('health') || intentLower.includes('real-time') || intentLower.includes('realtime'))
  ) {
    return 'operational-monitoring';
  }

  // ── PRIORITY 3: Table-heavy data ──────────────────────────────────
  if (context.dataShape.tableSuitableRatio > 0.6 || context.dataShape.fieldCount > 15) {
    return 'table-first';
  }

  // ── PRIORITY 4: High categorical diversity ────────────────────────
  if (
    context.dataShape.categoricalFields >= 3 &&
    context.dataShape.fieldCount >= 8 &&
    (intentLower.includes('analyze') || intentLower.includes('compare') || intentLower.includes('breakdown') || intentLower.includes('segment'))
  ) {
    return 'analytical-breakdown';
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

    case 'operational-monitoring':
      return `Operational signals: hasTimestamp=${context.dataShape.hasTimestamp}, statusFields=${context.dataShape.statusFields}, eventDensity=${context.dataShape.eventDensity}, intent includes monitoring keywords`;

    case 'table-first':
      return `Data-heavy: tableSuitableRatio=${context.dataShape.tableSuitableRatio.toFixed(2)}, fieldCount=${context.dataShape.fieldCount}${context.dataShape.fieldCount > 15 ? ' (>15)' : ''}`;

    case 'analytical-breakdown':
      return `Analytical: categoricalFields=${context.dataShape.categoricalFields}, fieldCount=${context.dataShape.fieldCount}, intent includes analysis keywords`;

    case 'executive-overview':
      return 'Default: no special signals matched → clean executive overview';

    default:
      return `Selected: ${selectedId}`;
  }
}
