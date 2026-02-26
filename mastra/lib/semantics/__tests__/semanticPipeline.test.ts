// mastra/lib/semantics/__tests__/semanticPipeline.test.ts
//
// Integration tests for the full dashboard field pipeline:
//   classifyField → applySemanticOverrides → enforceDashboardPolicies → sortByStoryOrder
//
// These tests prove the layers compose correctly. They use real field shapes
// that would come from actual platform data (n8n, vapi, make, retell).
//
// Contract assumptions (verified against actual code):
//   - loadFieldSemantics(platform) returns null for missing platforms (does NOT throw)
//   - loadFieldSemantics(platform) THROWS for invalid YAML (fail-loudly design)
//   - applySemanticOverrides always sets semanticSource on every field:
//       'heuristic' (no rule matched) or 'skill_override' (rule applied)
//   - enforceDashboardPolicies returns immutable copy with policyActions[]
//
// Run: npx vitest run mastra/lib/semantics/__tests__/semanticPipeline.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { applySemanticOverrides } from '../applySemanticOverrides';
import { loadFieldSemantics, clearSemanticsCache } from '../fieldSemantics';
import { enforceDashboardPolicies, sortByStoryOrder, POLICY_VERSION } from '../../policies/dashboardPolicy';
import type { BaseClassifiedField, DashboardField } from '../../types/dashboardField';

// ── Helper: simulate classifyField output ─────────────────────────────
// We inline a minimal version rather than importing the real classifyField
// from generateMapping.ts (which is a Mastra tool with execute() side effects).
// The shapes match what classifyField actually produces.

function fakeClassified(overrides: Partial<BaseClassifiedField>): BaseClassifiedField {
  return {
    name: 'test_field',
    type: 'string',
    shape: 'label',
    component: 'DataTable',
    aggregation: 'none',
    role: 'detail' as const,
    uniqueValues: 10,
    totalRows: 100,
    nullable: false,
    sample: 'test',
    skip: false,
    ...overrides,
  };
}

// ── Full pipeline helper ──────────────────────────────────────────────
// Runs Step 1.5 → Step 1.75 → Story Ordering in sequence.
// This is the exact same sequence that generateMapping.ts execute() runs.
function runFullPipeline(
  fields: BaseClassifiedField[],
  platform: string,
) {
  // Step 1.5: Semantic overrides (field-semantics.yaml rules)
  const afterSemantics = applySemanticOverrides(fields, platform);
  // Step 1.75: Policy enforcement (OPA-lite rules)
  const policyResult = enforceDashboardPolicies(afterSemantics);
  // Story ordering (hero → trend → breakdown → supporting → detail)
  const ordered = sortByStoryOrder(policyResult.fields);

  return { afterSemantics, policyResult, ordered };
}

// ═══════════════════════════════════════════════════════════════════════
// Suite 1: n8n Platform — Full Pipeline
// ═══════════════════════════════════════════════════════════════════════

describe('Full Pipeline: n8n', () => {
  beforeAll(() => {
    clearSemanticsCache();
  });

  it('workflow_id → MetricCard count (not PieChart), regardless of heuristic', () => {
    const fields = [
      fakeClassified({
        name: 'workflow_id',
        type: 'string',
        shape: 'id',
        component: 'PieChart',       // BAD heuristic guess
        aggregation: 'count_per_category',
        role: 'breakdown',
        uniqueValues: 50,
        totalRows: 500,
      }),
    ];

    const { policyResult, ordered } = runFullPipeline(fields, 'n8n');
    const wfId = ordered.find(f => f.name === 'workflow_id')!;

    // Either semantic layer overrides to MetricCard (skill_override)
    // or policy layer catches shape=id in chart (no_chart_identifiers).
    // Either way, the end result MUST be MetricCard count.
    expect(wfId.component).toBe('MetricCard');
    expect(wfId.aggregation).toBe('count');
    expect(wfId.skip).toBe(false);
  });

  it('status field becomes hero with percentage aggregation', () => {
    const fields = [
      fakeClassified({
        name: 'status',
        type: 'string',
        shape: 'status',
        component: 'MetricCard',
        aggregation: 'percentage',
        role: 'hero',
        uniqueValues: 3,
        totalRows: 500,
      }),
    ];

    const { ordered } = runFullPipeline(fields, 'n8n');
    const status = ordered.find(f => f.name === 'status')!;

    expect(status.role).toBe('hero');
    expect(status.component).toBe('MetricCard');
    expect(status.skip).toBe(false);
  });

  it('started_at with enough data points → TimeseriesChart trend', () => {
    const fields = [
      fakeClassified({
        name: 'started_at',
        type: 'string',
        shape: 'timestamp',
        component: 'TimeseriesChart',
        aggregation: 'count_over_time',
        role: 'trend',
        uniqueValues: 30,
        totalRows: 500,
      }),
    ];

    const { ordered } = runFullPipeline(fields, 'n8n');
    const ts = ordered.find(f => f.name === 'started_at')!;

    expect(ts.component).toBe('TimeseriesChart');
    expect(ts.role).toBe('trend');
    expect(ts.skip).toBe(false);
  });

  it('error_message (long text) → DataTable detail (never charted)', () => {
    const fields = [
      fakeClassified({
        name: 'error_message',
        type: 'string',
        shape: 'long_text',
        component: 'PieChart',    // BAD heuristic guess
        aggregation: 'count_per_category',
        role: 'breakdown',
        uniqueValues: 80,
        totalRows: 100,
      }),
    ];

    const { ordered } = runFullPipeline(fields, 'n8n');
    const err = ordered.find(f => f.name === 'error_message')!;

    expect(err.component).toBe('DataTable');
    expect(err.role).toBe('detail');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suite 2: vapi Platform — Full Pipeline
// ═══════════════════════════════════════════════════════════════════════

describe('Full Pipeline: vapi', () => {
  beforeAll(() => {
    clearSemanticsCache();
  });

  it('call_id → MetricCard count hero (not BarChart)', () => {
    const fields = [
      fakeClassified({
        name: 'call_id',
        type: 'string',
        shape: 'id',
        component: 'BarChart',
        aggregation: 'count_per_category',
        role: 'breakdown',
        uniqueValues: 200,
        totalRows: 200,
      }),
    ];

    const { ordered } = runFullPipeline(fields, 'vapi');
    const callId = ordered.find(f => f.name === 'call_id')!;

    expect(callId.component).toBe('MetricCard');
    expect(callId.aggregation).toBe('count');
    expect(callId.skip).toBe(false);
  });

  it('assistant_name (low cardinality) → PieChart breakdown survives', () => {
    const fields = [
      fakeClassified({
        name: 'assistant_name',
        type: 'string',
        shape: 'label',
        component: 'PieChart',
        aggregation: 'count_per_category',
        role: 'breakdown',
        uniqueValues: 4,
        totalRows: 200,
      }),
    ];

    const { ordered } = runFullPipeline(fields, 'vapi');
    const an = ordered.find(f => f.name === 'assistant_name')!;

    // Low cardinality (4 ≤ 8) → PieChart survives policy
    expect(an.component).toBe('PieChart');
    expect(an.role).toBe('breakdown');
  });

  it('transcript → DataTable detail (never charted)', () => {
    const fields = [
      fakeClassified({
        name: 'transcript',
        type: 'string',
        shape: 'long_text',
        component: 'BarChart',
        role: 'breakdown',
        uniqueValues: 190,
        totalRows: 200,
      }),
    ];

    const { ordered } = runFullPipeline(fields, 'vapi');
    const t = ordered.find(f => f.name === 'transcript')!;

    expect(t.component).toBe('DataTable');
    expect(t.role).toBe('detail');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suite 3: Cross-Platform Policy Rules
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Platform Policy Rules', () => {
  beforeAll(() => {
    clearSemanticsCache();
  });

  it('15-value categorical → BarChart (not PieChart, exceeds maxPieCardinality=8)', () => {
    const fields = [
      fakeClassified({
        name: 'category',
        type: 'string',
        shape: 'label',
        component: 'PieChart',
        aggregation: 'count_per_category',
        role: 'breakdown',
        uniqueValues: 15,
        totalRows: 100,
      }),
    ];

    const { policyResult } = runFullPipeline(fields, 'n8n');
    const cat = policyResult.fields.find(f => f.name === 'category')!;

    expect(cat.component).toBe('BarChart');
    expect(policyResult.violations.some(v => v.rule === 'pie_max_cardinality')).toBe(true);
  });

  it('constant field (uniqueValues=1, totalRows>1) → skipped', () => {
    const fields = [
      fakeClassified({
        name: 'platform',
        type: 'string',
        shape: 'label',
        component: 'PieChart',
        uniqueValues: 1,
        totalRows: 100,
      }),
    ];

    const { policyResult } = runFullPipeline(fields, 'n8n');
    const plat = policyResult.fields.find(f => f.name === 'platform')!;

    expect(plat.skip).toBe(true);
  });

  it('5 hero fields → 4 survive, 1 demoted to supporting', () => {
    const fields = [
      fakeClassified({ name: 'total_runs', role: 'hero' as const, component: 'MetricCard', shape: 'id', uniqueValues: 100, totalRows: 100 }),
      fakeClassified({ name: 'success_rate', role: 'hero' as const, component: 'MetricCard', shape: 'status', uniqueValues: 2, totalRows: 100 }),
      fakeClassified({ name: 'avg_duration', role: 'hero' as const, component: 'MetricCard', shape: 'duration', uniqueValues: 50, totalRows: 100 }),
      fakeClassified({ name: 'total_cost', role: 'hero' as const, component: 'MetricCard', shape: 'money', uniqueValues: 80, totalRows: 100 }),
      fakeClassified({ name: 'error_count', role: 'hero' as const, component: 'MetricCard', shape: 'numeric', uniqueValues: 10, totalRows: 100 }),
    ];

    const { policyResult } = runFullPipeline(fields, 'n8n');
    const heroes = policyResult.fields.filter(f => f.role === 'hero');
    const supporting = policyResult.fields.filter(f => f.role === 'supporting');

    expect(heroes.length).toBe(4);
    expect(supporting.length).toBe(1);
    expect(policyResult.violations.some(v => v.rule === 'max_hero_stats')).toBe(true);
  });

  it('unknown field with no semantic rule → heuristic-only, passes clean', () => {
    const fields = [
      fakeClassified({
        name: 'custom_xyz_metric',
        type: 'number',
        shape: 'numeric',
        component: 'MetricCard',
        aggregation: 'avg',
        role: 'supporting',
        uniqueValues: 50,
        totalRows: 100,
      }),
    ];

    const { afterSemantics, policyResult } = runFullPipeline(fields, 'n8n');
    const f = afterSemantics.find(f => f.name === 'custom_xyz_metric')!;

    // applySemanticOverrides always sets semanticSource on every returned field.
    // No rule matched → 'heuristic'. This is verified in applySemanticOverrides.ts:
    // "No rule found — pass through with heuristic source tag"
    expect(f.semanticSource).toBe('heuristic');
    // No policy violation → passes clean
    expect(policyResult.violations.length).toBe(0);
  });

  it('sparse timeseries (2 data points) → MetricCard, not TimeseriesChart', () => {
    const fields = [
      fakeClassified({
        name: 'created_at',
        type: 'string',
        shape: 'timestamp',
        component: 'TimeseriesChart',
        aggregation: 'count_over_time',
        role: 'trend',
        uniqueValues: 2,
        totalRows: 5,
      }),
    ];

    const { policyResult } = runFullPipeline(fields, 'n8n');
    const f = policyResult.fields.find(f => f.name === 'created_at')!;

    expect(f.component).toBe('MetricCard');
    expect(f.role).toBe('supporting');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suite 4: Story Ordering
// ═══════════════════════════════════════════════════════════════════════

describe('Story Ordering', () => {
  it('orders fields: hero → trend → breakdown → supporting → detail → skipped', () => {
    const fields = [
      fakeClassified({ name: 'detail_field', role: 'detail' as const, component: 'DataTable', skip: false }),
      fakeClassified({ name: 'hero_field', role: 'hero' as const, component: 'MetricCard', skip: false }),
      fakeClassified({ name: 'trend_field', role: 'trend' as const, component: 'TimeseriesChart', shape: 'timestamp', skip: false }),
      fakeClassified({ name: 'skipped_field', role: 'detail' as const, skip: true, skipReason: 'constant' }),
      fakeClassified({ name: 'breakdown_field', role: 'breakdown' as const, component: 'PieChart', skip: false, uniqueValues: 5 }),
      fakeClassified({ name: 'supporting_field', role: 'supporting' as const, component: 'MetricCard', skip: false }),
    ];

    const ordered = sortByStoryOrder(fields);
    const names = ordered.map(f => f.name);

    expect(names).toEqual([
      'hero_field',
      'trend_field',
      'breakdown_field',
      'supporting_field',
      'detail_field',
      'skipped_field',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suite 5: Pipeline Metadata & Edge Cases
// ═══════════════════════════════════════════════════════════════════════

describe('Pipeline Metadata & Edge Cases', () => {
  it('policy version is consistent across calls', () => {
    const fields = [fakeClassified({ name: 'x', component: 'MetricCard' })];
    const { afterSemantics } = runFullPipeline(fields, 'n8n');

    // afterSemantics returns DashboardField[] which enforceDashboardPolicies accepts
    const result = enforceDashboardPolicies(afterSemantics);
    expect(result.version).toBe(POLICY_VERSION);
    expect(typeof POLICY_VERSION).toBe('number');
  });

  it('platform with no YAML → returns null from loader, no crash, heuristic-only', () => {
    clearSemanticsCache();

    // loadFieldSemantics returns null for missing platforms (verified in fieldSemantics.ts:
    // "No semantics file — legitimate for platforms without config yet")
    // It only THROWS on invalid YAML (fail-loudly for bad config).
    const config = loadFieldSemantics('nonexistent_platform_zzz');
    expect(config).toBeNull();

    const fields = [
      fakeClassified({ name: 'some_field', component: 'MetricCard', role: 'hero' as const }),
    ];

    // Full pipeline should not throw — graceful fallback to heuristic
    const { afterSemantics } = runFullPipeline(fields, 'nonexistent_platform_zzz');
    expect(afterSemantics[0].semanticSource).toBe('heuristic');
  });

  it('empty fields array → no crash, empty results', () => {
    const { policyResult, ordered } = runFullPipeline([], 'n8n');

    expect(policyResult.fields).toHaveLength(0);
    expect(policyResult.violations).toHaveLength(0);
    expect(ordered).toHaveLength(0);
  });
});
