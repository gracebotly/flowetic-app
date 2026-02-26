// mastra/lib/policies/__tests__/dashboardPolicy.test.ts

import { describe, it, expect } from 'vitest';
import {
  enforceDashboardPolicies,
  sortByStoryOrder,
  POLICY_VERSION,
  DEFAULT_POLICY_CONFIG,
} from '../dashboardPolicy';
import type { DashboardField } from '../../types/dashboardField';

// ── Helper: Create a minimal valid DashboardField ────────────────────
function makeField(overrides: Partial<DashboardField>): DashboardField {
  return {
    name: 'test_field',
    type: 'string',
    shape: 'label',
    component: 'DataTable',
    aggregation: 'count',
    role: 'detail',
    uniqueValues: 10,
    totalRows: 100,
    nullable: false,
    sample: 'test',
    skip: false,
    semanticSource: 'heuristic',
    policyActions: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════

describe('enforceDashboardPolicies', () => {
  it('returns correct POLICY_VERSION', () => {
    const result = enforceDashboardPolicies([makeField({})]);
    expect(result.version).toBe(POLICY_VERSION);
    expect(DEFAULT_POLICY_CONFIG.maxHeroStats).toBe(4);
  });

  // ── Rule 1: Identifiers cannot be charted ───────────────────────────
  it('blocks shape=id from PieChart → MetricCard count', () => {
    const field = makeField({
      name: 'workflow_id',
      shape: 'id',
      component: 'PieChart',
      aggregation: 'count_per_category',
      role: 'breakdown',
      uniqueValues: 50,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    const out = result.fields[0];

    expect(out.component).toBe('MetricCard');
    expect(out.aggregation).toBe('count');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rule).toBe('no_chart_identifiers');
    expect(out.policyActions).toContain('id_chart_blocked→MetricCard');
  });

  // ── Rule 2: Surrogate keys forced to MetricCard ─────────────────────
  it('blocks surrogate_key from BarChart → MetricCard count', () => {
    const field = makeField({
      name: 'execution_id',
      shape: 'id',
      component: 'BarChart',
      role: 'breakdown',
      uniqueValues: 500,
      totalRows: 500,
      semanticSource: 'skill_override',
      appliedRule: { semantic_type: 'surrogate_key', reason: 'test', version: 1 },
    });

    const result = enforceDashboardPolicies([field]);
    const out = result.fields[0];

    expect(out.component).toBe('MetricCard');
    expect(out.aggregation).toBe('count');
    // Both rule 1 (id shape) and rule 2 (surrogate_key) fire
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some(v => v.rule === 'no_chart_surrogate_keys')).toBe(true);
  });

  // ── Rule 3: PieChart cardinality overflow ───────────────────────────
  it('downgrades PieChart to BarChart when uniqueValues=12 > maxPieCardinality=8', () => {
    const field = makeField({
      name: 'category',
      shape: 'label',
      component: 'PieChart',
      aggregation: 'count_per_category',
      role: 'breakdown',
      uniqueValues: 12,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    expect(result.fields[0].component).toBe('BarChart');
    expect(result.violations[0].rule).toBe('pie_max_cardinality');
  });

  // ── Rule 3b: PieChart extreme overflow → DataTable ──────────────────
  it('downgrades PieChart to DataTable when uniqueValues=50 > maxBarCategories=20', () => {
    const field = makeField({
      name: 'error_codes',
      shape: 'label',
      component: 'PieChart',
      aggregation: 'count_per_category',
      role: 'breakdown',
      uniqueValues: 50,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    expect(result.fields[0].component).toBe('DataTable');
    expect(result.fields[0].role).toBe('detail');
  });

  // ── Rule 5: TimeseriesChart on non-timestamp ────────────────────────
  it('blocks TimeseriesChart on non-timestamp field → BarChart', () => {
    const field = makeField({
      name: 'status',
      shape: 'status',
      component: 'TimeseriesChart',
      role: 'trend',
      uniqueValues: 3,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    expect(result.fields[0].component).toBe('BarChart');
    expect(result.violations[0].rule).toBe('timeseries_requires_timestamp');
  });

  // ── Rule 6: Single-value fields skipped ─────────────────────────────
  it('skips fields with uniqueValues=1, totalRows>1, shape!=status', () => {
    const field = makeField({
      name: 'platform',
      shape: 'label',
      component: 'PieChart',
      uniqueValues: 1,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    expect(result.fields[0].skip).toBe(true);
    expect(result.fields[0].policyActions).toContain('constant_skipped');
  });

  // ── Rule 7: Detail fields → DataTable ───────────────────────────────
  it('forces long_text in PieChart → DataTable detail', () => {
    const field = makeField({
      name: 'error_message',
      shape: 'long_text',
      component: 'PieChart',
      role: 'breakdown',
      uniqueValues: 80,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    expect(result.fields[0].component).toBe('DataTable');
    expect(result.fields[0].role).toBe('detail');
  });

  // ── Rule 8: Max 4 hero stats ────────────────────────────────────────
  it('demotes excess hero fields to supporting, preserving skill_override heroes', () => {
    const fields = [
      makeField({ name: 'total_runs', role: 'hero', semanticSource: 'skill_override' }),
      makeField({ name: 'success_rate', role: 'hero', semanticSource: 'skill_override' }),
      makeField({ name: 'avg_duration', role: 'hero', semanticSource: 'skill_override' }),
      makeField({ name: 'total_cost', role: 'hero', semanticSource: 'skill_override' }),
      makeField({ name: 'extra_metric', role: 'hero', semanticSource: 'heuristic' }),
      makeField({ name: 'another_metric', role: 'hero', semanticSource: 'heuristic' }),
    ];

    const result = enforceDashboardPolicies(fields);
    const heroes = result.fields.filter(f => f.role === 'hero');
    const demoted = result.fields.filter(f => f.policyActions?.some(a => a.includes('hero_overflow')));

    expect(heroes).toHaveLength(4);
    expect(demoted).toHaveLength(2);
    // The 2 heuristic heroes should be the ones demoted
    expect(demoted.every(f => f.semanticSource === 'heuristic')).toBe(true);
    expect(demoted.every(f => f.role === 'supporting')).toBe(true);
  });

  // ── Stats validation: uniqueValues > totalRows clamped ──────────────
  it('clamps uniqueValues to totalRows when uniqueValues > totalRows', () => {
    const field = makeField({
      name: 'broken_stats',
      uniqueValues: 200,
      totalRows: 100,
    });

    const result = enforceDashboardPolicies([field]);
    expect(result.fields[0].uniqueValues).toBe(100);
    expect(result.statsWarnings.length).toBeGreaterThan(0);
  });
});

describe('sortByStoryOrder', () => {
  it('sorts hero → trend → breakdown → supporting → detail, skipped last', () => {
    const fields = [
      makeField({ name: 'detail', role: 'detail', skip: false }),
      makeField({ name: 'hero', role: 'hero', skip: false }),
      makeField({ name: 'skipped', role: 'hero', skip: true }),
      makeField({ name: 'trend', role: 'trend', skip: false }),
      makeField({ name: 'breakdown', role: 'breakdown', skip: false }),
      makeField({ name: 'supporting', role: 'supporting', skip: false }),
    ];

    const sorted = sortByStoryOrder(fields);
    const names = sorted.map(f => f.name);
    expect(names).toEqual(['hero', 'trend', 'breakdown', 'supporting', 'detail', 'skipped']);
  });
});
