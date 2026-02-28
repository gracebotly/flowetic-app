// mastra/lib/policies/dashboardPolicy.ts
//
// Enterprise-grade OPA-lite policy enforcement for dashboard field classifications.
//
// Runs AFTER applySemanticOverrides() and BEFORE mapping build.
// Does NOT mutate input — copies fields, applies rules, returns immutable result.
//
// Design principles:
//   1. Shared type contract (DashboardField from types/dashboardField.ts)
//   2. Upstream stats validation (catches bad data before policy runs)
//   3. Immutable transformation (snapshot before, diff after)
//   4. Policy versioning (POLICY_VERSION in all outputs)
//   5. Config-driven thresholds (overridable per platform/template)
//   6. Full explainability (per-field policyActions list)

import type { DashboardField, FieldRole } from '../types/dashboardField';

// ============================================================================
// Policy Version (increment when rules change)
// ============================================================================

export const POLICY_VERSION = 2;

// ============================================================================
// Configurable Thresholds
// ============================================================================

export interface PolicyConfig {
  /** Max categories before PieChart → BarChart downgrade. Default 8. */
  maxPieCardinality: number;
  /** Max hero stat cards in Row 1. Default 4. */
  maxHeroStats: number;
  /** Max categories for BarChart before → DataTable. Default 20. */
  maxBarCategories: number;
  /** Minimum rows needed for TimeseriesChart to be meaningful. Default 5. */
  minRowsForTrends: number;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  maxPieCardinality: 8,
  maxHeroStats: 4,
  maxBarCategories: 20,
  minRowsForTrends: 5,
};

// ============================================================================
// Policy Result Types
// ============================================================================

export interface PolicyViolation {
  field: string;
  rule: string;
  severity: 'error' | 'warning';
  action: string;
  before: { component: string; role: FieldRole; aggregation: string; skip: boolean };
  after: { component: string; role: FieldRole; aggregation: string; skip: boolean };
}

export interface PolicyResult {
  /** New field array (original is NOT mutated) */
  fields: DashboardField[];
  violations: PolicyViolation[];
  autoFixCount: number;
  version: number;
  statsWarnings: string[];
}

// ============================================================================
// Chart Component Detection
// ============================================================================

const CHART_COMPONENTS = ['PieChart', 'BarChart', 'TimeseriesChart', 'LineChart', 'AreaChart', 'DonutChart'] as const;

function isChartComponent(component: string): boolean {
  return (CHART_COMPONENTS as readonly string[]).includes(component);
}

// ============================================================================
// Step 1.7: Upstream Stats Validation
// ============================================================================

function validateFieldStats(fields: DashboardField[]): { validFields: DashboardField[]; warnings: string[] } {
  const warnings: string[] = [];
  const validFields = fields.map(f => {
    const copy = { ...f };

    // Invariant: uniqueValues cannot exceed totalRows
    if (copy.uniqueValues > copy.totalRows && copy.totalRows > 0) {
      warnings.push(
        `${copy.name}: uniqueValues (${copy.uniqueValues}) > totalRows (${copy.totalRows}) — clamped`
      );
      copy.uniqueValues = copy.totalRows;
    }

    // Invariant: totalRows must be positive for any meaningful classification
    if (copy.totalRows <= 0) {
      warnings.push(
        `${copy.name}: totalRows=${copy.totalRows} — invalid, forcing skip`
      );
      copy.skip = true;
      copy.skipReason = 'Policy: totalRows <= 0 — invalid field stats';
      copy.policyActions = [...(copy.policyActions || []), 'stats_invalid_skip'];
    }

    // Invariant: uniqueValues must be non-negative
    if (copy.uniqueValues < 0) {
      warnings.push(
        `${copy.name}: uniqueValues=${copy.uniqueValues} — negative, reset to 0`
      );
      copy.uniqueValues = 0;
    }

    return copy;
  });

  if (warnings.length > 0) {
    console.warn(`[dashboardPolicy] Stats validation warnings (${warnings.length}):`, warnings);
  }

  return { validFields, warnings };
}

// ============================================================================
// Step 1.75: Policy Enforcement
// ============================================================================

export function enforceDashboardPolicies(
  inputFields: DashboardField[],
  config: Partial<PolicyConfig> = {},
): PolicyResult {
  const cfg: PolicyConfig = { ...DEFAULT_POLICY_CONFIG, ...config };
  const violations: PolicyViolation[] = [];

  // ── Stats validation first ────────────────────────────────────────
  const { validFields, warnings: statsWarnings } = validateFieldStats(inputFields);

  // ── Deep copy for immutability ────────────────────────────────────
  const fields: DashboardField[] = validFields.map(f => ({
    ...f,
    policyActions: [...(f.policyActions || [])],
    appliedRule: f.appliedRule ? { ...f.appliedRule } : undefined,
  }));

  for (const f of fields) {
    if (f.skip) continue;

    const snapshot = { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip };

    // ── Rule 1: Identifiers cannot be charted ───────────────────────
    if (f.shape === 'id' && isChartComponent(f.component)) {
      f.component = 'MetricCard';
      f.aggregation = 'count';
      f.policyActions!.push('id_chart_blocked→MetricCard');
      violations.push({
        field: f.name,
        rule: 'no_chart_identifiers',
        severity: 'error',
        action: 'Downgraded to MetricCard count',
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 2: Surrogate keys cannot be charted ────────────────────
    if (
      f.appliedRule?.semantic_type === 'surrogate_key' &&
      isChartComponent(f.component)
    ) {
      f.component = 'MetricCard';
      f.aggregation = 'count';
      f.policyActions!.push('surrogate_key_chart_blocked→MetricCard');
      violations.push({
        field: f.name,
        rule: 'no_chart_surrogate_keys',
        severity: 'error',
        action: 'Forced to MetricCard count',
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 3: PieChart max cardinality ────────────────────────────
    if (f.component === 'PieChart' && f.uniqueValues > cfg.maxPieCardinality) {
      const prevComponent = f.component;
      if (f.uniqueValues > cfg.maxBarCategories) {
        f.component = 'DataTable';
        f.aggregation = 'none';
        f.role = 'detail';
        f.policyActions!.push(`pie_overflow→DataTable(${f.uniqueValues}>${cfg.maxBarCategories})`);
      } else {
        f.component = 'BarChart';
        f.policyActions!.push(`pie_overflow→BarChart(${f.uniqueValues}>${cfg.maxPieCardinality})`);
      }
      violations.push({
        field: f.name,
        rule: 'pie_max_cardinality',
        severity: 'warning',
        action: `${prevComponent} → ${f.component} (${f.uniqueValues} categories)`,
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 4: BarChart max cardinality ────────────────────────────
    if (f.component === 'BarChart' && f.uniqueValues > cfg.maxBarCategories) {
      f.component = 'DataTable';
      f.aggregation = 'none';
      f.role = 'detail';
      f.policyActions!.push(`bar_overflow→DataTable(${f.uniqueValues}>${cfg.maxBarCategories})`);
      violations.push({
        field: f.name,
        rule: 'bar_max_cardinality',
        severity: 'warning',
        action: `BarChart → DataTable (${f.uniqueValues} > ${cfg.maxBarCategories})`,
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 5: TimeseriesChart requires timestamp shape + min rows ─
    if (f.component === 'TimeseriesChart') {
      if (f.shape !== 'timestamp') {
        f.component = 'BarChart';
        f.policyActions!.push('timeseries_wrong_shape→BarChart');
        violations.push({
          field: f.name,
          rule: 'timeseries_requires_timestamp',
          severity: 'error',
          action: 'TimeseriesChart on non-timestamp → BarChart',
          before: snapshot,
          after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
        });
      } else if (f.uniqueValues < cfg.minRowsForTrends) {
        f.component = 'MetricCard';
        f.aggregation = 'count';
        f.role = 'supporting';
        f.policyActions!.push(`sparse_timeseries→MetricCard(${f.uniqueValues}<${cfg.minRowsForTrends})`);
        violations.push({
          field: f.name,
          rule: 'timeseries_min_rows',
          severity: 'warning',
          action: `Sparse timeseries (${f.uniqueValues} points) → MetricCard`,
          before: snapshot,
          after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
        });
      }
    }

    // ── Rule 6: Single-value fields skipped ─────────────────────────
    if (f.uniqueValues <= 1 && f.totalRows > 1 && f.shape !== 'status' && !f.skip) {
      f.skip = true;
      f.skipReason = 'Policy: single unique value — no information content';
      f.policyActions!.push('constant_skipped');
      violations.push({
        field: f.name,
        rule: 'skip_constants',
        severity: 'warning',
        action: 'Skipped — single unique value',
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 7: Detail fields cannot be charted ─────────────────────
    if (
      (f.shape === 'long_text' || f.shape === 'high_cardinality_text') &&
      isChartComponent(f.component)
    ) {
      f.component = 'DataTable';
      f.aggregation = 'none';
      f.role = 'detail';
      f.policyActions!.push('detail_field→DataTable');
      violations.push({
        field: f.name,
        rule: 'detail_fields_table_only',
        severity: 'warning',
        action: `${f.shape} → DataTable`,
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 7a: Sparse field guard (Phase 3) ───────────────────────
    // Fields with >50% null values should not be visualized as charts.
    // Sparse data produces misleading aggregations (e.g., avg of 3 non-null
    // values out of 100 rows). Downgrade to DataTable for detail viewing.
    if (
      f.nullRate !== undefined &&
      f.nullRate > 0.5 &&
      f.sparseField === true &&
      isChartComponent(f.component)
    ) {
      f.component = 'DataTable';
      f.role = 'detail';
      f.policyActions!.push('sparse_field_chart_blocked');
      violations.push({
        field: f.name,
        rule: 'sparse_field_guard',
        severity: 'warning',
        action: `Sparse field (nullRate=${f.nullRate.toFixed(2)}) → DataTable`,
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }

    // ── Rule 7b: Rich text guard (Phase 3) ──────────────────────────
    // Fields classified as rich_text should never be charted — they contain
    // free-form content (AI summaries, research reports, etc.) that has no
    // meaningful aggregation. Force to ContentCard with aggregation='none'.
    if (
      f.shape === 'rich_text' &&
      isChartComponent(f.component)
    ) {
      f.component = 'ContentCard';
      f.aggregation = 'none';
      f.role = 'detail';
      f.policyActions!.push('rich_text_chart_blocked→ContentCard');
      violations.push({
        field: f.name,
        rule: 'rich_text_guard',
        severity: 'warning',
        action: `rich_text field → ContentCard (aggregation=none)`,
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }
  }

  // ── Rule 8: Max hero stats (cross-field) ──────────────────────────
  const activeHeroes = fields.filter(f => !f.skip && f.role === 'hero');
  if (activeHeroes.length > cfg.maxHeroStats) {
    // Preserve skill_override heroes; demote heuristic heroes first
    const sorted = [...activeHeroes].sort((a, b) => {
      const aScore = a.semanticSource === 'skill_override' ? 1 : 0;
      const bScore = b.semanticSource === 'skill_override' ? 1 : 0;
      return bScore - aScore;
    });

    const demoted = sorted.slice(cfg.maxHeroStats);
    for (const f of demoted) {
      const snapshot = { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip };
      f.role = 'supporting';
      f.policyActions!.push(`hero_overflow→supporting(${activeHeroes.length}>${cfg.maxHeroStats})`);
      violations.push({
        field: f.name,
        rule: 'max_hero_stats',
        severity: 'warning',
        action: `Demoted hero → supporting (${activeHeroes.length} > ${cfg.maxHeroStats})`,
        before: snapshot,
        after: { component: f.component, role: f.role, aggregation: f.aggregation, skip: f.skip },
      });
    }
  }

  // ── Observability ─────────────────────────────────────────────────
  if (violations.length > 0) {
    console.log(
      `[dashboardPolicy v${POLICY_VERSION}] Enforced ${violations.length} rules:`,
      violations.map(v => `${v.field}: ${v.rule} (${v.action})`),
    );
  } else {
    console.log(`[dashboardPolicy v${POLICY_VERSION}] All fields passed policy checks`);
  }

  return {
    fields,
    violations,
    autoFixCount: violations.length,
    version: POLICY_VERSION,
    statsWarnings,
  };
}

// ============================================================================
// Dashboard Story Ordering
// Progressive reveal: hero → trend → breakdown → supporting → detail
// ============================================================================

export const DASHBOARD_STORY_ORDER: Record<string, number> = {
  hero: 0,
  trend: 1,
  breakdown: 2,
  supporting: 3,
  detail: 4,
};

export function sortByStoryOrder<T extends { role: string; skip: boolean }>(
  fields: T[],
): T[] {
  return [...fields].sort((a, b) => {
    if (a.skip && !b.skip) return 1;
    if (!a.skip && b.skip) return -1;
    const aOrder = DASHBOARD_STORY_ORDER[a.role] ?? 99;
    const bOrder = DASHBOARD_STORY_ORDER[b.role] ?? 99;
    return aOrder - bOrder;
  });
}
