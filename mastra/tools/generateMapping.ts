// mastra/tools/generateMapping.ts
//
// DATA-DRIVEN FIELD MAPPING (replaces hardcoded template requirements)
//
// Implements the Data Dashboard Intelligence skill:
//   Section 1: Field-to-Component Mapping (shape + semantic → component)
//   Section 2: Aggregation Selection (semantic → count/avg/sum/percentage)
//   Section 3: Dashboard Story Structure (progressive reveal layout)
//   Section 7: Chart Type Decision Tree (cardinality-driven selection)
//
// NO hardcoded template requirements. Every field from analyzeSchema is
// classified, mapped, and passed through. The skill's rules decide what
// component each field becomes — not a static dictionary.

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { computeDataSignals } from '../lib/layout/dataSignals';
import { applySemanticOverrides } from '../lib/semantics';
import { enforceDashboardPolicies, sortByStoryOrder, POLICY_VERSION } from '../lib/policies';
import type { DashboardField, FieldShape, BaseClassifiedField } from '../lib/types/dashboardField';

// ============================================================================
// Field Shape Classification (Skill Section 1)
// ============================================================================

const DURATION_PATTERNS = /duration|time|elapsed|_ms$|_sec$|runtime|run_time|latency/i;
const MONEY_PATTERNS = /cost|amount|price|spend|revenue|fee|charge|total_cost/i;
const RATE_PATTERNS = /rate|ratio|percent|score|accuracy|precision|recall/i;
const ID_PATTERNS = /^id$|_id$|execution_id|call_id|session_id|message_id|run_id|workflow_id/i;
const TIMESTAMP_PATTERNS = /^timestamp$|_at$|_time$|created|started|ended|finished|stopped|completed|date$/i;
const STATUS_PATTERNS = /^status$|^state$|^result$|^outcome$/i;

function isDateParseable(sample: unknown): boolean {
  if (typeof sample !== 'string') return false;
  const d = new Date(sample);
  return !isNaN(d.getTime()) && sample.length > 6;
}

function classifyField(field: {
  name: string;
  type: string;
  sample: unknown;
  nullable: boolean;
  uniqueValues: number;
  totalRows: number;
  nullCount?: number;
  avgLength?: number;
  arrayItemType?: string;
}): BaseClassifiedField {
  const { name, type, sample, nullable, uniqueValues, totalRows } = field;
  const avgLength = field.avgLength ?? 0;
  const cardinalityRatio = totalRows > 0 ? uniqueValues / totalRows : 0;
  const nullRate = (field.nullCount ?? 0) / Math.max(field.totalRows ?? 1, 1);

  let shape: FieldShape = 'unknown';
  let component = 'DataTable';
  let aggregation = 'count';
  let role: DashboardField['role'] = 'detail';
  let skip = false;
  let skipReason: string | undefined;

  // ── Override: Skip fields with exactly 1 unique value (no information content) ──
  if (uniqueValues === 1 && totalRows > 1) {
    // Exception: status with 1 value IS useful ("All errors" is a finding)
    if (!STATUS_PATTERNS.test(name)) {
      skip = true;
      skipReason = `Single unique value across ${totalRows} rows — no information content`;
    }
  }

  // ── Shape detection (order matters — more specific patterns first) ──

  // 1. ID (high cardinality unique identifier)
  if (ID_PATTERNS.test(name) && cardinalityRatio > 0.9) {
    shape = 'id';
    component = 'MetricCard';
    aggregation = 'count';
    role = 'hero';
  }
  // 2. Status (categorical, 2-8 values)
  else if (STATUS_PATTERNS.test(name) && type === 'string') {
    if (uniqueValues === 2) {
      shape = 'binary';
      component = 'MetricCard';
      aggregation = 'percentage';
      role = 'hero';
    } else if (uniqueValues >= 2 && uniqueValues <= 8) {
      shape = 'status';
      // Skill Section 7: 2-6 values → PieChart, 7+ → BarChart
      component = uniqueValues <= 6 ? 'PieChart' : 'BarChart';
      aggregation = 'count_per_category';
      role = 'breakdown';
    } else if (uniqueValues === 1) {
      // All same status — show as metric card "All [value]"
      shape = 'binary';
      component = 'MetricCard';
      aggregation = 'percentage';
      role = 'supporting';
    } else {
      shape = 'label';
      component = 'BarChart';
      aggregation = 'count_per_category';
      role = 'breakdown';
    }
  }
  // 3. Timestamp (datetime fields)
  else if (TIMESTAMP_PATTERNS.test(name) || (type === 'date') || isDateParseable(sample)) {
    shape = 'timestamp';
    // Skill Section 7: ≥5 data points → TimeseriesChart, <5 → BarChart fallback
    if (uniqueValues >= 5) {
      component = 'TimeseriesChart';
      aggregation = 'count_per_interval';
      role = 'trend';
    } else {
      // Sparse timeseries look broken — MetricCard fallback per skill override rules
      component = 'MetricCard';
      aggregation = 'count';
      role = 'supporting';
      skip = uniqueValues < 2;
      skipReason = uniqueValues < 2 ? 'Sparse timestamp — fewer than 2 distinct dates' : undefined;
    }
  }
  // 4. Duration (numeric, positive, time-related)
  else if (DURATION_PATTERNS.test(name)) {
    shape = 'duration';
    component = 'MetricCard';
    aggregation = 'avg';
    role = 'supporting';
  }
  // 5. Money (numeric, currency-like)
  else if (MONEY_PATTERNS.test(name)) {
    shape = 'money';
    component = 'MetricCard';
    aggregation = 'sum';
    role = 'supporting';
  }
  // 6. Rate (numeric, 0-100 or 0-1)
  else if (RATE_PATTERNS.test(name)) {
    shape = 'rate';
    component = 'MetricCard';
    aggregation = 'avg';
    role = 'supporting';
  }
  // 7. Rich text: long-form AI-generated content (summaries, reports)
  // Must be checked BEFORE long_text (which catches avgLength > 100)
  else if (type === 'string' && avgLength > 200) {
    shape = 'rich_text';
    component = 'ContentCard';
    aggregation = 'none';
    role = 'detail';
  }
  // 8. Nested object: complex structured data that wasn't fully flattened
  else if (type === 'object') {
    shape = 'nested_object';
    component = 'DataTable';
    aggregation = 'none';
    role = 'detail';
  }
  // 9. Array field: lists of items (key_findings[], recommendations[])
  else if (type === 'array') {
    shape = 'array_field';
    component = 'DataTable';
    aggregation = 'none';
    role = 'detail';
  }
  // 10. Long text (avg length > 100)
  else if (type === 'string' && avgLength > 100) {
    shape = 'long_text';
    component = 'DataTable';
    aggregation = 'none';
    role = 'detail';
  }
  // 11. High cardinality text (>50 unique string values)
  else if (type === 'string' && uniqueValues > 50) {
    shape = 'high_cardinality_text';
    component = 'DataTable';
    aggregation = 'none';
    role = 'detail';
  }
  // 12. Label (medium cardinality categorical, 3-50 values)
  else if (type === 'string' && uniqueValues >= 3 && uniqueValues <= 50) {
    shape = 'label';
    // Skill Section 7: 2-6 → PieChart, 7-15 → horizontal BarChart, 16+ → DataTable
    if (uniqueValues <= 6) {
      component = 'PieChart';
    } else if (uniqueValues <= 15) {
      component = 'BarChart';
    } else {
      component = 'DataTable';
    }
    aggregation = 'count_per_category';
    role = 'breakdown';
  }
  // 13. Low cardinality string (2 values, non-status)
  else if (type === 'string' && uniqueValues === 2) {
    shape = 'binary';
    component = 'MetricCard';
    aggregation = 'percentage';
    role = 'supporting';
  }
  // 14. Generic numeric
  else if (type === 'number') {
    shape = 'numeric';
    component = 'MetricCard';
    aggregation = 'avg';
    role = 'supporting';
  }

  // Sparse field guard: fields with >50% null rate should not be charted
  const sparseField = nullRate > 0.5;
  if (sparseField && ['BarChart', 'PieChart', 'DonutChart', 'LineChart', 'TimeseriesChart', 'AreaChart'].includes(component)) {
    // Downgrade chart to table — charting sparse data produces "Unknown: N" slices
    component = 'DataTable';
    role = 'detail';
  }

  // Field group tagging: fields with dot-notation get tagged with their prefix
  const dotIndex = name.indexOf('.');
  const fieldGroup = dotIndex > 0 ? name.substring(0, dotIndex) : undefined;

  return {
    name,
    type,
    shape,
    component,
    aggregation,
    role,
    uniqueValues,
    totalRows,
    nullable,
    sample,
    skip,
    skipReason,
    fieldGroup,
    sparseField,
    nullRate: Math.round(nullRate * 100) / 100,
    ...(shape === 'array_field' && field.arrayItemType ? { arrayItemType: field.arrayItemType } : {}),
  };
}

// ============================================================================
// Semantic Alias Map (KEPT from old code — still useful for name resolution)
// Used to create canonical mappings for well-known field purposes
// ============================================================================

const SEMANTIC_ALIASES: Record<string, string[]> = {
  'workflow_id': ['workflow_id', 'workflowId', 'flow_id', 'flowId', 'automation_id', 'process_id'],
  'execution_id': ['execution_id', 'executionId', 'run_id', 'runId'],
  'status': ['status', 'state', 'execution_status', 'executionStatus', 'result', 'outcome'],
  'started_at': ['started_at', 'startedAt', 'start_time', 'startTime', 'created_at', 'createdAt'],
  'ended_at': ['ended_at', 'endedAt', 'finished_at', 'finishedAt', 'stopped_at', 'stoppedAt', 'completed_at'],
  'duration_ms': ['duration_ms', 'durationMs', 'duration', 'elapsed_time', 'execution_time', 'runtime'],
  'error_message': ['error_message', 'errorMessage', 'error', 'failure_reason'],
  'workflow_name': ['workflow_name', 'workflowName', 'scenario_name', 'automation_name'],
  'call_id': ['call_id', 'callId', 'session_id', 'sessionId', 'conversation_id'],
  'transcript': ['transcript', 'conversation', 'messages'],
  'cost': ['cost', 'price', 'amount', 'total_cost', 'cost_usd'],
  'platform': ['platform', 'source', 'provider', 'service', 'platformType'],
  'timestamp': ['timestamp', 'created_at', 'time', 'date'],
};

function resolveCanonicalName(fieldName: string): string | null {
  const lower = fieldName.toLowerCase();
  for (const [canonical, aliases] of Object.entries(SEMANTIC_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === lower)) {
      return canonical;
    }
  }
  return null;
}

// ============================================================================
// Chart Recommendation Builder (Skill Section 7)
// Replaces BM25-random chart selection with data-shape-driven selection
// ============================================================================

function buildChartRecommendations(
  classified: DashboardField[],
): Array<{ type: string; bestFor: string; fieldName: string }> {
  const recs: Array<{ type: string; bestFor: string; fieldName: string }> = [];
  const activeFields = classified.filter(f => !f.skip);

  // Find the best field for each component role
  const trendFields = activeFields.filter(f => f.role === 'trend');
  const breakdownFields = activeFields.filter(f => f.role === 'breakdown');

  // Trend chart (TimeseriesChart — full width, Row 2 per story structure)
  for (const f of trendFields) {
    recs.push({
      type: f.component, // 'TimeseriesChart'
      bestFor: `${f.name.replace(/_/g, ' ')} trend over time`,
      fieldName: f.name,
    });
  }

  // Breakdown charts (PieChart/BarChart — Row 3 per story structure)
  for (const f of breakdownFields) {
    recs.push({
      type: f.component, // 'PieChart' or 'BarChart' based on cardinality
      bestFor: `Distribution by ${f.name.replace(/_/g, ' ')}`,
      fieldName: f.name,
    });
  }

  // If no trend field was found but we have temporal data, add a count-over-time chart
  if (trendFields.length === 0) {
    const anyTimestamp = activeFields.find(f => f.shape === 'timestamp');
    if (anyTimestamp) {
      recs.push({
        type: 'BarChart',
        bestFor: `Activity by ${anyTimestamp.name.replace(/_/g, ' ')}`,
        fieldName: anyTimestamp.name,
      });
    }
  }

  // Always include a DataTable for detail drill-down (Row 4 per story structure)
  recs.push({
    type: 'DataTable',
    bestFor: 'Recent activity detail',
    fieldName: '_all',
  });

  return recs;
}

// ============================================================================
// The Tool
// ============================================================================

export const generateMapping = createTool({
  id: 'generateMapping',
  description:
    'Classifies all event fields by shape and semantic using Data Dashboard Intelligence skill rules. ' +
    'Returns ALL fields as mappings (nothing dropped), plus field analysis and data-driven chart recommendations. ' +
    'No hardcoded template requirements — every dashboard is custom-built from actual data.',
  inputSchema: z.object({
    templateId: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      sample: z.any().optional(),
      nullable: z.boolean().optional(),
      uniqueValues: z.number().optional(),
      totalRows: z.number().optional(),
      nullCount: z.number().optional(),
      avgLength: z.number().optional(),
      arrayItemType: z.string().optional(),
    })),
    platformType: z.string(),
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    fieldAnalysis: z.array(z.object({
      name: z.string(),
      type: z.string(),
      shape: z.string(),
      component: z.string(),
      aggregation: z.string(),
      role: z.string(),
      uniqueValues: z.number(),
      totalRows: z.number(),
      skip: z.boolean(),
      skipReason: z.string().optional(),
      fieldGroup: z.string().optional(),
      sparseField: z.boolean().optional(),
      nullRate: z.number().optional(),
      arrayItemType: z.string().optional(),
      semanticSource: z.enum(['heuristic', 'skill_override']).optional(),
      references: z.string().optional(),
      displayName: z.string().optional(),
      policyActions: z.array(z.string()).optional(),
    })),
    chartRecommendations: z.array(z.object({
      type: z.string(),
      bestFor: z.string(),
      fieldName: z.string(),
    })),
    dataSignals: z.object({
      fieldCount: z.number(),
      hasTimestamp: z.boolean(),
      hasTimeSeries: z.boolean(),
      hasBreakdown: z.boolean(),
      statusFields: z.number(),
      categoricalFields: z.number(),
      tableSuitableRatio: z.number(),
      eventDensity: z.enum(['low', 'medium', 'high']),
      dataStory: z.enum(['healthy', 'warning', 'critical', 'unknown']),
      dataDisplayMode: z.enum(['metrics', 'records', 'hybrid']),
      richTextFields: z.array(z.string()),
      fieldGroups: z.array(z.object({
        prefix: z.string(),
        fields: z.array(z.string()),
        avgNullRate: z.number(),
      })),
      sparseFields: z.array(z.string()),
      layoutQuery: z.string(),
      summary: z.string(),
    }).optional(),
    missingFields: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    policy: z.object({
      version: z.number(),
      violations: z.array(z.object({
        field: z.string(),
        rule: z.string(),
        severity: z.enum(['error', 'warning']),
        action: z.string(),
      })),
      autoFixCount: z.number(),
      statsWarnings: z.array(z.string()),
    }).optional(),
  }),
  execute: async (inputData, context) => {
    const { templateId, fields, platformType } = inputData;

    // ── Step 1: Classify every field using heuristic rules ─────────────
    const heuristicClassified = fields.map(f => classifyField({
      name: f.name,
      type: f.type,
      sample: f.sample,
      nullable: f.nullable ?? false,
      uniqueValues: f.uniqueValues ?? 1,
      totalRows: f.totalRows ?? 1,
      nullCount: f.nullCount,
      avgLength: f.avgLength,
      arrayItemType: f.arrayItemType,
    }));

    // ── Step 1.5: Apply semantic overrides from field-semantics.yaml ───
    // This is where skills become executable. The YAML config for this
    // platform overrides heuristic classifications with semantic rules.
    // Precedence: heuristic → skill override → safety guard
    const semanticClassified = applySemanticOverrides(heuristicClassified, platformType) as DashboardField[];

    // ── Step 1.75: Policy enforcement (OPA-lite) ──────────────────────
    // Validates upstream stats, then enforces dashboard governance rules.
    // Does NOT mutate semanticClassified — returns new array.
    const policyResult = enforceDashboardPolicies(semanticClassified);

    // ── Step 1.85: Story ordering ─────────────────────────────────────
    // Sort fields by dashboard story order (hero → trend → breakdown → supporting → detail)
    // so downstream UI builders receive them in render-ready progressive-reveal order.
    const classified = sortByStoryOrder(policyResult.fields);

    // ── Step 2: Build mappings — ALL fields pass through ───────────────
    // Canonical name resolution for well-known fields
    // EVERY field gets a mapping entry. Nothing is dropped.
    const mappings: Record<string, string> = {};
    for (const field of classified) {
      const canonical = resolveCanonicalName(field.name);
      if (canonical && !mappings[canonical]) {
        mappings[canonical] = field.name;
      }
      // Always include the raw field name as well
      if (!mappings[field.name]) {
        mappings[field.name] = field.name;
      }
    }

    // ── Step 3: Build data-driven chart recommendations ────────────────
    const chartRecommendations = buildChartRecommendations(classified);

    // ── Step 4: Determine confidence ───────────────────────────────────
    const activeFields = classified.filter(f => !f.skip);
    const hasHero = activeFields.some(f => f.role === 'hero');
    const hasTrend = activeFields.some(f => f.role === 'trend');
    const hasBreakdown = activeFields.some(f => f.role === 'breakdown');

    let confidence = 0.5; // Base
    if (hasHero) confidence += 0.2;
    if (hasTrend) confidence += 0.15;
    if (hasBreakdown) confidence += 0.15;
    confidence = Math.min(1.0, confidence);

    // missingFields is empty — we don't drop fields anymore.
    // But flag if we're missing critical dashboard ingredients.
    const missingFields: string[] = [];
    if (!hasHero) missingFields.push('_no_hero_stat (no countable ID or binary status field)');
    if (!hasTrend) missingFields.push('_no_trend_data (no timestamp field with ≥5 data points)');

    const semanticOverrides = classified.filter(
      f => f.semanticSource === 'skill_override'
    );

    console.log('[generateMapping] Skill-driven mapping complete:', {
      templateId,
      platformType,
      totalFields: fields.length,
      activeFields: activeFields.length,
      skippedFields: classified.filter(f => f.skip).length,
      semanticOverrides: semanticOverrides.length,
      semanticOverrideFields: semanticOverrides.map(f => f.name),
      policyVersion: policyResult.version,
      policyVersionExpected: POLICY_VERSION,
      policyViolations: policyResult.violations.length,
      policyStatsWarnings: policyResult.statsWarnings.length,
      mappingsCount: Object.keys(mappings).length,
      chartRecommendations: chartRecommendations.map(r => `${r.type}(${r.fieldName})`),
      roles: {
        hero: activeFields.filter(f => f.role === 'hero').map(f => f.name),
        supporting: activeFields.filter(f => f.role === 'supporting').map(f => f.name),
        trend: activeFields.filter(f => f.role === 'trend').map(f => f.name),
        breakdown: activeFields.filter(f => f.role === 'breakdown').map(f => f.name),
        detail: activeFields.filter(f => f.role === 'detail').map(f => f.name),
      },
      confidence,
    });

    // ── Step 5: Compute data signals for skeleton selection (Phase 2) ──
    const fieldAnalysisOutput = classified.map(f => ({
      name: f.name,
      type: f.type,
      shape: f.shape,
      component: f.component,
      aggregation: f.aggregation,
      role: f.role,
      uniqueValues: f.uniqueValues,
      totalRows: f.totalRows,
      skip: f.skip,
      skipReason: f.skipReason,
      fieldGroup: f.fieldGroup,
      sparseField: f.sparseField,
      nullRate: f.nullRate,
      arrayItemType: f.arrayItemType,
      semanticSource: f.semanticSource,
      references: f.references,
      displayName: f.displayName,
      policyActions: f.policyActions,
    }));

    const dataSignals = computeDataSignals(fieldAnalysisOutput, mappings);

    console.log('[generateMapping] Data signals computed:', {
      fieldCount: dataSignals.fieldCount,
      hasTimestamp: dataSignals.hasTimestamp,
      hasTimeSeries: dataSignals.hasTimeSeries,
      statusFields: dataSignals.statusFields,
      categoricalFields: dataSignals.categoricalFields,
      tableSuitableRatio: dataSignals.tableSuitableRatio.toFixed(2),
      eventDensity: dataSignals.eventDensity,
      dataStory: dataSignals.dataStory,
      layoutQuery: dataSignals.layoutQuery.substring(0, 80),
    });

    return {
      mappings,
      fieldAnalysis: fieldAnalysisOutput,
      chartRecommendations,
      dataSignals,
      missingFields,
      confidence,
      policy: {
        version: policyResult.version,
        violations: policyResult.violations.map(v => ({
          field: v.field,
          rule: v.rule,
          severity: v.severity,
          action: v.action,
        })),
        autoFixCount: policyResult.autoFixCount,
        statsWarnings: policyResult.statsWarnings,
      },
    };
  },
});
