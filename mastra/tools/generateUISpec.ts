import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { selectSkeleton, type SelectionContext, type UIType } from '../lib/layout/skeletonSelector';
import { getSkeleton, SKELETON_VERSION, type LayoutSkeleton, type SkeletonId } from '../lib/layout/skeletons';
import type { DataSignals } from '../lib/layout/dataSignals';

// ============================================================================
// Style bundle catalog
// Used to resolve selectedStyleBundleId → design tokens
// Design selection now handled by designSystemWorkflow + ui-ux-pro-max skill
// ============================================================================
/**
 * STYLE_BUNDLE_TOKENS — DEPRECATED.
 * Kept as empty record for backward compatibility with savePreviewVersion imports.
 * All design tokens now come from designSystemWorkflow → CSV data.
 * If no custom tokens exist, the system should trigger the design workflow,
 * NOT fall back to hardcoded presets.
 */
export const STYLE_BUNDLE_TOKENS: Record<string, {
  colors: { primary: string; secondary: string; success: string; warning: string; error: string; background: string; text: string };
  fonts: { heading: string; body: string };
  spacing: { unit: number };
  radius: number;
  shadow: string;
}> = {};

// ============================================================================
// Template component blueprints — deterministic base per template type
// Each blueprint defines a full multi-component dashboard layout
// ============================================================================

interface ComponentBlueprint {
  id: string;
  type: string;
  propsBuilder: (mappings: Record<string, string>, fields: string[]) => Record<string, unknown>;
  layout: { col: number; row: number; w: number; h: number };
}

/**
 * Intelligently pick a field from mappings or fall back to available fields.
 * Priority: exact key match → partial key match → first available field → fallback
 */
function pickField(
  mappings: Record<string, string>,
  preferredKeys: string[],
  fallback: string
): string {
  // Try exact match in mappings
  for (const key of preferredKeys) {
    if (mappings[key]) return mappings[key];
  }
  // Try partial match in mapping keys
  const mappingKeys = Object.keys(mappings);
  for (const key of preferredKeys) {
    const found = mappingKeys.find(k => k.toLowerCase().includes(key.toLowerCase()));
    if (found && mappings[found]) return mappings[found];
  }
  // Try partial match in mapping values
  for (const key of preferredKeys) {
    const found = Object.values(mappings).find(v => v.toLowerCase().includes(key.toLowerCase()));
    if (found) return found;
  }
  return fallback;
}

// ============================================================================
// Design-Token-Driven Component Builder
// REPLACES all hardcoded template functions. Every dashboard is unique.
// If no chart recommendations exist, this throws — no silent fallback.
// ============================================================================

/**
 * Sanitize entity/workflow name for use in dashboard titles.
 * Strips platform prefixes, template numbers, execution suffixes.
 * Applies vocabulary normalization per data-dashboard-intelligence SKILL.md.
 * Humanizes slug-style names (kebab-case → Title Case).
 *
 * Examples:
 *   "n8n:Template 2: Website Chatbot Analytics Aggregator:execution"
 *   → "Website Chatbot Analytics Aggregator"
 *
 *   "workflow-dashboard" → "Workflow Dashboard"
 *   "n8n" → "Workflow" (platform name → universal term)
 */
function cleanEntityName(raw: string): string {
  let cleaned = raw
    .replace(/^n8n:/i, '')
    .replace(/^make:/i, '')
    .replace(/^vapi:/i, '')
    .replace(/^retell:/i, '')
    .replace(/^activepieces:/i, '')
    .replace(/^mastra:/i, '')
    .replace(/^crewai:/i, '')
    .replace(/:execution$/i, '')
    .replace(/:operation$/i, '')
    .replace(/:call$/i, '')
    .replace(/^Template\s*\d+:\s*/i, '')
    .trim();

  // Platform-only names → universal term (never show raw platform slugs)
  const platformMap: Record<string, string> = {
    'n8n': 'Workflow',
    'make': 'Scenario',
    'vapi': 'Call',
    'retell': 'Call',
    'mastra': 'Workflow',
    'crewai': 'Agent Task',
    'activepieces': 'Workflow',
  };
  if (platformMap[cleaned.toLowerCase()]) {
    return platformMap[cleaned.toLowerCase()];
  }

  // Humanize slug-style names: "workflow-dashboard" → "Workflow Dashboard"
  if (cleaned.includes('-') && !cleaned.includes(' ')) {
    cleaned = cleaned
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Vocabulary normalization per SKILL.md — whole-word only
  cleaned = cleaned
    .replace(/\bexecution\b/gi, 'Run')
    .replace(/\bexecutions\b/gi, 'Runs')
    .replace(/\bscenario\b/gi, 'Workflow')
    .replace(/\bscenarios\b/gi, 'Workflows')
    .replace(/\boperation\b/gi, 'Run')
    .replace(/\boperations\b/gi, 'Runs')
    .replace(/\bassistant\b/gi, 'Agent')
    .replace(/\bassistants\b/gi, 'Agents');

  return cleaned || 'Dashboard';
}

/**
 * Convert raw database field names into clean, human-readable dashboard labels.
 * Strips technical suffixes (_ms, _id, _at, _url, _count, _num),
 * maps well-known field names to friendly terms, and title-cases the result.
 *
 * Per data-dashboard-intelligence SKILL.md Section 6:
 * "Never use raw field names as titles. Never use technical aggregation syntax."
 *
 * Examples:
 *   "duration_ms"    → "Duration"
 *   "execution_id"   → "Executions"
 *   "started_at"     → "Started"
 *   "workflow_name"   → "Workflow"
 *   "error_message"  → "Errors"
 *   "call_duration"  → "Call Duration"
 *   "status"         → "Status"
 */
function humanizeFieldName(raw: string): string {
  // Well-known field name mappings (exact match on raw name)
  const FIELD_LABEL_MAP: Record<string, string> = {
    'execution_id': 'Executions',
    'run_id': 'Runs',
    'workflow_id': 'Workflow',
    'call_id': 'Calls',
    'id': 'Records',
    'duration_ms': 'Duration',
    'duration': 'Duration',
    'execution_time': 'Execution Time',
    'elapsed_time': 'Elapsed Time',
    'runtime': 'Runtime',
    'started_at': 'Started',
    'ended_at': 'Ended',
    'created_at': 'Created',
    'updated_at': 'Updated',
    'finished_at': 'Finished',
    'completed_at': 'Completed',
    'timestamp': 'Time',
    'error_message': 'Errors',
    'error_count': 'Errors',
    'workflow_name': 'Workflow',
    'scenario_name': 'Scenario',
    'status': 'Status',
    'result': 'Result',
    'outcome': 'Outcome',
    'cost': 'Cost',
    'total_cost': 'Total Cost',
    'amount': 'Amount',
    'score': 'Score',
    'success_rate': 'Success Rate',
    'failure_rate': 'Failure Rate',
  };

  const lower = raw.toLowerCase();
  if (FIELD_LABEL_MAP[lower]) return FIELD_LABEL_MAP[lower];

  // Strip known technical suffixes, then title-case
  let cleaned = raw
    .replace(/_ms$/i, '')
    .replace(/_id$/i, '')
    .replace(/_at$/i, '')
    .replace(/_url$/i, '')
    .replace(/_uri$/i, '')
    .replace(/_count$/i, '')
    .replace(/_num$/i, '')
    .replace(/_ts$/i, '')
    .replace(/_uuid$/i, '');

  // Convert snake_case / camelCase to Title Case
  cleaned = cleaned
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim();

  return cleaned || raw;
}

/**
 * Smart pluralization for dashboard titles.
 * Returns the entity name as-is for titles where plural would sound wrong,
 * and applies basic English pluralization otherwise.
 */
function pluralizeEntity(word: string): string {
  if (!word) return 'Items';
  // Short abbreviations or single words ≤4 chars — don't pluralize, use contextual noun
  if (word.length <= 4 && !/\s/.test(word)) return word + ' Runs';
  const lower = word.toLowerCase();
  // Already ends with s (like "Analytics") — don't double-pluralize
  if (lower.endsWith('s')) return word;
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (lower.endsWith('sh') || lower.endsWith('ch') || lower.endsWith('x') || lower.endsWith('z')) return word + 'es';
  return word + 's';
}

/**
 * Extract a short entity noun for use in KPI titles.
 * For long workflow names like "Lead Qualification Pipeline with ROI Tracker",
 * returns the vocabulary-normalized noun (e.g., "Run") instead of the full name.
 * For short names (≤3 words), returns the name as-is.
 */
function shortEntityNoun(cleanedEntity: string): string {
  const words = cleanedEntity.trim().split(/\s+/);
  // Short names are fine as-is
  if (words.length <= 3) return cleanedEntity;
  // For long workflow names, use the universal noun "Run" (per SKILL.md vocabulary normalization)
  // The full name goes in the dashboard title; KPI cards use the short noun
  return 'Run';
}

/**
 * Map a design system chart recommendation type to a renderer component type.
 * Handles compound types like "Pie Chart or Donut" and "Bar Chart (Horizontal or Vertical)"
 * by checking for partial keyword matches when exact match fails.
 */
function mapChartRecToComponentType(recType: string): string {
  const normalized = recType.toLowerCase().trim();

  // Exact match first (fastest path)
  const exactMap: Record<string, string> = {
    'funnel chart': 'BarChart',
    'roi metric card': 'MetricCard',
    'stacked bar chart': 'BarChart',
    'kpi cards': 'MetricCard',
    'kpi card': 'MetricCard',
    'data tables': 'DataTable',
    'data table': 'DataTable',
    'line chart': 'TimeseriesChart',
    'timeseries chart': 'TimeseriesChart',
    'time series chart': 'TimeseriesChart',
    'bar chart': 'BarChart',
    'pie chart': 'PieChart',
    'donut chart': 'DonutChart',
    'area chart': 'TimeseriesChart',
    'gauge': 'MetricCard',
    'metric card': 'MetricCard',
    'table': 'DataTable',
    'heatmap': 'BarChart',
    'scatter chart': 'TimeseriesChart',
    'grouped bar chart': 'BarChart',
    'horizontal bar chart': 'BarChart',
    'radar chart': 'BarChart',
    'bubble chart': 'TimeseriesChart',
    'treemap': 'BarChart',
    'waterfall chart': 'BarChart',
    'combo chart': 'TimeseriesChart',
    'sparkline': 'TimeseriesChart',
  };

  if (exactMap[normalized]) return exactMap[normalized];

  // Partial keyword match for compound types like "Pie Chart or Donut",
  // "Bar Chart (Horizontal or Vertical)", etc.
  // Order matters: check more specific keywords first.
  const keywordMap: Array<[string, string]> = [
    ['pie', 'PieChart'],
    ['donut', 'DonutChart'],
    ['line', 'TimeseriesChart'],
    ['timeseries', 'TimeseriesChart'],
    ['time series', 'TimeseriesChart'],
    ['area', 'TimeseriesChart'],
    ['scatter', 'TimeseriesChart'],
    ['bar', 'BarChart'],
    ['funnel', 'BarChart'],
    ['table', 'DataTable'],
    ['gauge', 'MetricCard'],
    ['kpi', 'MetricCard'],
    ['metric', 'MetricCard'],
  ];

  for (const [keyword, componentType] of keywordMap) {
    if (normalized.includes(keyword)) return componentType;
  }

  return 'BarChart';
}

/**
 * Build dashboard components driven by the design system's chart recommendations.
 *
 * This is the ONLY component builder. There are no fallback templates.
 * The designSystemWorkflow MUST have run and produced chart recommendations.
 * If it didn't, this function throws.
 */
/**
 * Build dashboard components using the Data Dashboard Intelligence skill's
 * story structure (Section 3) and field analysis from generateMapping.
 *
 * Layout follows the skill's progressive reveal principle:
 *   Row 1: Hero stat + Supporting KPI cards (3-4 cards)
 *   Row 2: Trend chart (TimeseriesChart, full width)
 *   Row 3: Breakdown charts (BarChart + PieChart, half width each)
 *   Row 4: Data table (full width)
 *
 * If fieldAnalysis is provided (from skill-driven generateMapping), components
 * are built from actual data shapes. If only chartRecs is provided (legacy
 * designSystemWorkflow BM25 path), falls back to the old behavior.
 */
// ============================================================================
// Skeleton-Aware Dashboard Component Builder (Phase 2)
// Replaces the fixed layout with 11 deterministic skeletons.
// The old buildComponentsFromDesignTokens() is kept as LEGACY fallback.
// ============================================================================

function buildDashboardComponentsFromSkeleton(
  skeleton: LayoutSkeleton,
  mappings: Record<string, string>,
  chartRecs: Array<{ type: string; bestFor: string; fieldName?: string }>,
  entityName: string,
  fieldAnalysis?: Array<{
    name: string; type: string; shape: string; component: string;
    aggregation: string; role: string; uniqueValues: number;
    totalRows: number; skip: boolean; skipReason?: string;
  }>,
  designPatterns?: Array<{ content: string; source: string; score: number }>,
): ComponentBlueprint[] {
  const components: ComponentBlueprint[] = [];
  const entity = cleanEntityName(entityName);
  const allFields = Object.values(mappings);
  let row = 0;

  const active = fieldAnalysis?.filter(f => !f.skip) || [];
  const heroes = active.filter(f => f.role === 'hero');
  const supporting = active.filter(f => f.role === 'supporting');
  const trends = active.filter(f => f.role === 'trend');
  const breakdowns = active.filter(f => f.role === 'breakdown');
  const layoutHints = extractLayoutHints(designPatterns);

  for (const section of skeleton.sections) {
    const sectionHeight = section.minHeight || 2;

    switch (section.type) {
      case 'kpi-grid': {
        const maxKPIs = Math.min(section.maxItems || skeleton.maxKPIs, skeleton.maxKPIs);
        const kpiFields = [...heroes, ...supporting].slice(0, maxKPIs);
        if (kpiFields.length > 0) {
          const kpiWidth = Math.floor(12 / Math.min(kpiFields.length, maxKPIs));
          kpiFields.forEach((field, idx) => {
            components.push({
              id: `kpi-${idx}`,
              type: 'MetricCard',
              propsBuilder: (m) => ({
                title: humanizeFieldName(field.name),
                valueField: m[field.name] || field.name,
                aggregation: field.aggregation,
                icon: idx === 0 ? 'activity' : idx === 1 ? 'check-circle' : 'clock',
              }),
              layout: { col: idx * kpiWidth, row, w: kpiWidth, h: section.compact ? 1 : 2 },
            });
          });
        } else {
          const fallbackKPIs = [
            { title: `Total ${pluralizeEntity(shortEntityNoun(entity))}`, field: pickField(mappings, ['execution_id', 'run_id', 'id', 'call_id'], 'id'), agg: 'count', icon: 'activity' },
            { title: `${shortEntityNoun(entity)} Success Rate`, field: pickField(mappings, ['status', 'result', 'outcome'], 'status'), agg: 'percentage', icon: 'check-circle' },
            { title: 'Avg Duration', field: pickField(mappings, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'), agg: 'avg', icon: 'clock' },
          ].slice(0, skeleton.maxKPIs);
          const kpiWidth = Math.floor(12 / fallbackKPIs.length);
          fallbackKPIs.forEach((kpi, idx) => {
            components.push({
              id: `kpi-${idx}`,
              type: 'MetricCard',
              propsBuilder: () => ({ title: kpi.title, valueField: kpi.field, aggregation: kpi.agg, icon: kpi.icon }),
              layout: { col: idx * kpiWidth, row, w: kpiWidth, h: section.compact ? 1 : 2 },
            });
          });
        }
        row += section.compact ? 1 : 2;
        break;
      }
      case 'chart': {
        const width = section.columns || 12;
        const colStart = section.columns < 12 ? (section.dominant ? 0 : (12 - section.columns)) : 0;
        if (trends.length > 0) {
          const trendField = trends[0];
          components.push({
            id: `chart-trend-${row}`,
            type: 'TimeseriesChart',
            propsBuilder: (m) => ({
              title: `${humanizeFieldName(trendField.name)} Over Time`,
              xAxisField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
              yAxisField: m[trendField.name] || trendField.name,
              aggregation: trendField.aggregation,
            }),
            layout: { col: colStart, row, w: width, h: sectionHeight > 2 ? sectionHeight : 3 },
          });
        } else {
          const bdField = breakdowns[0];
          components.push({
            id: `chart-primary-${row}`,
            type: 'BarChart',
            propsBuilder: (m) => ({
              title: bdField ? `${humanizeFieldName(bdField.name)} Distribution` : `${shortEntityNoun(entity)} Activity`,
              categoryField: bdField ? (m[bdField.name] || bdField.name) : pickField(m, ['status', 'type', 'category'], 'status'),
              valueField: pickField(m, ['execution_id', 'run_id', 'id'], 'id'),
              aggregation: 'count',
            }),
            layout: { col: colStart, row, w: width, h: sectionHeight > 2 ? sectionHeight : 3 },
          });
        }
        row += sectionHeight > 2 ? sectionHeight : 3;
        break;
      }
      case 'table': {
        const tableColumns = active.length > 0
          ? active.slice(0, 8).map(f => ({ key: f.name, label: humanizeFieldName(f.name) }))
          : allFields.slice(0, 6).map(f => ({ key: f, label: humanizeFieldName(f) }));
        const tableHeight = section.dominant ? 5 : 4;
        components.push({
          id: `table-${row}`,
          type: 'DataTable',
          propsBuilder: () => ({
            title: `${shortEntityNoun(entity)} Details`,
            columns: tableColumns,
            pageSize: section.dominant ? 20 : 10,
            sortable: true,
          }),
          layout: { col: 0, row, w: 12, h: tableHeight },
        });
        row += tableHeight;
        break;
      }
      case 'feed': {
        components.push({
          id: `feed-${row}`,
          type: 'DataTable',
          propsBuilder: (m) => ({
            title: `Live ${shortEntityNoun(entity)} Feed`,
            columns: active.slice(0, 5).map(f => ({ key: f.name, label: humanizeFieldName(f.name) })),
            pageSize: 15,
            sortable: true,
            defaultSort: { field: pickField(m, ['timestamp', 'created_at', 'time'], 'timestamp'), direction: 'desc' },
          }),
          layout: { col: 0, row, w: 12, h: 4 },
        });
        row += 4;
        break;
      }
      case 'insight-card': {
        components.push({
          id: `insight-${row}`,
          type: 'MetricCard',
          propsBuilder: (m) => ({
            title: layoutHints.insightHeadline || 'Key Insight',
            valueField: heroes.length > 0 ? (m[heroes[0].name] || heroes[0].name) : pickField(m, ['execution_id', 'run_id', 'id'], 'id'),
            aggregation: heroes.length > 0 ? heroes[0].aggregation : 'count',
            variant: 'hero',
            narrative: true,
          }),
          layout: { col: 0, row, w: 12, h: 3 },
        });
        row += 3;
        break;
      }
      case 'filters': {
        components.push({
          id: `filters-${row}`,
          type: 'MetricCard',
          propsBuilder: () => ({ title: 'Filters', valueField: 'filter_placeholder', aggregation: 'count', variant: 'filter-bar' }),
          layout: { col: 0, row, w: 12, h: 1 },
        });
        row += 1;
        break;
      }
      default:
        break;
    }
  }

  return components;
}

function extractLayoutHints(
  designPatterns?: Array<{ content: string; source: string; score: number }>,
): {
  insightHeadline?: string;
  emphasisColor?: string;
  preferDarkMode?: boolean;
  statusIndicators?: boolean;
  realTimeUpdates?: boolean;
} {
  if (!designPatterns || designPatterns.length === 0) return {};
  const allContent = designPatterns.map(p => p.content.toLowerCase()).join(' ');
  return {
    realTimeUpdates: allContent.includes('real-time') || allContent.includes('real time') || allContent.includes('live'),
    statusIndicators: allContent.includes('status indicator') || allContent.includes('health check'),
    preferDarkMode: allContent.includes('dark mode') || allContent.includes('dark theme') || allContent.includes('dark palette'),
    emphasisColor: allContent.includes('trust') && allContent.includes('blue') ? 'trust-blue' : undefined,
  };
}

function buildProductComponentsFromSkeleton(
  skeleton: LayoutSkeleton,
  input: { entityName?: string; platformType?: string; designPatterns?: Array<{ content: string; source: string; score: number }> },
): ComponentBlueprint[] {
  const components: ComponentBlueprint[] = [];
  const entity = cleanEntityName(input.entityName || 'Product');
  let row = 0;
  for (const section of skeleton.sections) {
    if (section.type === 'hero') {
      components.push({ id: `hero-${row}`, type: 'HeroSection', propsBuilder: () => ({ headline: `${entity}`, subheadline: 'Powered by AI automation', ctaText: 'Get Started', ctaLink: '#pricing' }), layout: { col: 0, row, w: 12, h: 3 } });
      row += 3;
    }
  }
  return components;
}

function buildAdminComponentsFromSkeleton(
  skeleton: LayoutSkeleton,
  input: { entityName?: string; platformType?: string; designPatterns?: Array<{ content: string; source: string; score: number }> },
): ComponentBlueprint[] {
  const components: ComponentBlueprint[] = [];
  const entity = cleanEntityName(input.entityName || 'Records');
  let row = 0;
  for (const section of skeleton.sections) {
    if (section.type === 'page-header') {
      components.push({ id: `header-${row}`, type: 'PageHeader', propsBuilder: () => ({ title: entity }), layout: { col: 0, row, w: 12, h: 1 } });
      row += 1;
    }
  }
  return components;
}

function buildComponentsFromDesignTokens(
  mappings: Record<string, string>,
  chartRecs: Array<{ type: string; bestFor: string; fieldName?: string }>,
  entityName: string,
  fieldAnalysis?: Array<{
    name: string; type: string; shape: string; component: string;
    aggregation: string; role: string; uniqueValues: number;
    totalRows: number; skip: boolean; skipReason?: string;
  }>,
): ComponentBlueprint[] {
  const components: ComponentBlueprint[] = [];
  const entity = cleanEntityName(entityName);
  const allFields = Object.values(mappings);
  let row = 0;

  // ── Use field analysis if available (skill-driven path) ────────────
  if (fieldAnalysis && fieldAnalysis.length > 0) {
    const active = fieldAnalysis.filter(f => !f.skip);
    const heroes = active.filter(f => f.role === 'hero');
    const supporting = active.filter(f => f.role === 'supporting');
    const trends = active.filter(f => f.role === 'trend');
    const breakdowns = active.filter(f => f.role === 'breakdown');

    // ── ROW 0: KPI cards (hero + supporting, max 4) ──────────────────
    const kpiFields = [...heroes, ...supporting].slice(0, 4);
    const kpiWidth = kpiFields.length > 0 ? Math.floor(12 / Math.min(kpiFields.length, 4)) : 4;

    kpiFields.forEach((f, i) => {
      components.push({
        id: `kpi-${f.name}`,
        type: 'MetricCard',
        propsBuilder: (m) => {
          const fieldName = m[f.name] || f.name;
          let title: string;
          let icon: string;
          switch (f.aggregation) {
            case 'count':
              title = `Total ${pluralizeEntity(shortEntityNoun(entity))}`;
              icon = 'activity';
              break;
            case 'percentage':
              title = `${shortEntityNoun(entity)} Success Rate`;
              icon = 'check-circle';
              break;
            case 'avg':
              title = `Avg. ${humanizeFieldName(f.name)}`;
              icon = 'clock';
              break;
            case 'sum':
              title = `Total ${humanizeFieldName(f.name)}`;
              icon = 'dollar-sign';
              break;
            default:
              title = `${shortEntityNoun(entity)} ${humanizeFieldName(f.name)}`;
              icon = 'bar-chart-2';
          }
          const unit = f.shape === 'duration' ? 'ms' : undefined;
          const condition = f.aggregation === 'percentage'
            ? { equals: 'success' }
            : undefined;
          return {
            title,
            valueField: fieldName,
            aggregation: f.aggregation === 'count_per_category' ? 'count' : f.aggregation,
            icon,
            ...(unit ? { unit } : {}),
            ...(condition ? { condition } : {}),
          };
        },
        layout: { col: i * kpiWidth, row, w: kpiWidth, h: 2 },
      });
    });

    if (kpiFields.length === 0) {
      components.push({
        id: 'primary-kpi',
        type: 'MetricCard',
        propsBuilder: (m) => ({
          title: `Total ${pluralizeEntity(shortEntityNoun(entity))}`,
          valueField: pickField(m, ['execution_id', 'run_id', 'id'], 'id'),
          aggregation: 'count',
          icon: 'activity',
        }),
        layout: { col: 0, row, w: 4, h: 2 },
      });
    }

    row += 2;

    // ── ROW 2: Trend chart (full width) ──────────────────────────────
    for (const f of trends.slice(0, 1)) {
      components.push({
        id: `trend-${f.name}`,
        type: 'TimeseriesChart',
        propsBuilder: (m) => ({
          title: `${pluralizeEntity(shortEntityNoun(entity))} Over Time`,
          dateField: m[f.name] || f.name,
          valueField: pickField(m, ['execution_id', 'run_id', 'id', 'status'], 'id'),
          aggregation: 'count_per_interval',
        }),
        layout: { col: 0, row, w: 12, h: 4 },
      });
      row += 4;
    }

    // ── ROW 3: Breakdown charts (half width each) ────────────────────
    const breakdownSlots = breakdowns.slice(0, 2);
    const breakdownWidth = breakdownSlots.length === 1 ? 12 : 6;
    breakdownSlots.forEach((f, i) => {
      components.push({
        id: `breakdown-${f.name}`,
        type: f.component as string,
        propsBuilder: (m) => {
          const fieldName = m[f.name] || f.name;
          const base: Record<string, unknown> = {
            title: f.component === 'PieChart'
              ? `${pluralizeEntity(shortEntityNoun(entity))} by ${humanizeFieldName(f.name)}`
              : `Top ${humanizeFieldName(f.name)}`,
            dataKey: fieldName,
            valueKey: 'count',
          };
          return base;
        },
        layout: { col: i * breakdownWidth, row, w: breakdownWidth, h: 4 },
      });
    });
    if (breakdownSlots.length > 0) row += 4;

    // ── ROW 4: Data table (full width) ───────────────────────────────
    const tableColumns = active
      .filter(f => f.shape !== 'long_text' || active.length <= 8)
      .slice(0, 8)
      .map(f => ({
        key: f.name,
        label: humanizeFieldName(f.name),
      }));

    components.push({
      id: 'activity-table',
      type: 'DataTable',
      propsBuilder: () => ({
        title: `Recent ${pluralizeEntity(shortEntityNoun(entity))}`,
        columns: tableColumns.length > 0 ? tableColumns : [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'timestamp', label: 'Time' },
        ],
        pageSize: 10,
      }),
      layout: { col: 0, row, w: 12, h: 4 },
    });

    console.log(
      `[buildComponentsFromDesignTokens] Built ${components.length} SKILL-DRIVEN components ` +
      `from ${active.length} active fields for "${entity}" ` +
      `(${heroes.length} hero, ${supporting.length} supporting, ${trends.length} trend, ${breakdowns.length} breakdown)`
    );

    return components;
  }

  // ── LEGACY PATH: chartRecs from designSystemWorkflow BM25 ──────────
  let metricCount = 0;

  // ROW 0: Three KPI cards (always present)
  components.push({
    id: 'primary-kpi',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `Total ${pluralizeEntity(shortEntityNoun(entity))}`,
      valueField: pickField(m, ['execution_id', 'run_id', 'id'], 'id'),
      aggregation: 'count',
      icon: 'activity',
    }),
    layout: { col: 0, row, w: 4, h: 2 },
  });

  components.push({
    id: 'success-kpi',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `${shortEntityNoun(entity)} Success Rate`,
      valueField: pickField(m, ['status', 'result', 'outcome'], 'status'),
      aggregation: 'percentage',
      condition: { equals: 'success' },
      icon: 'check-circle',
    }),
    layout: { col: 4, row, w: 4, h: 2 },
  });

  components.push({
    id: 'duration-kpi',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `Avg ${shortEntityNoun(entity)} Duration`,
      valueField: pickField(m, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'),
      aggregation: 'avg',
      unit: 'ms',
      icon: 'clock',
    }),
    layout: { col: 8, row, w: 4, h: 2 },
  });

  row += 2;
  metricCount = 3;

  // ROWS 2+: Components from chart recommendations
  for (let i = 0; i < chartRecs.length; i++) {
    const rec = chartRecs[i];
    const componentType = mapChartRecToComponentType(rec.type);

    if (componentType === 'MetricCard' && metricCount >= 4) continue;
    if (componentType === 'MetricCard') metricCount++;

    const chartId = `rec-${i}-${componentType.toLowerCase()}`;
    const isFullWidth = componentType === 'DataTable' || componentType === 'TimeseriesChart';
    const width = isFullWidth ? 12 : 8;

    components.push({
      id: chartId,
      type: componentType,
      propsBuilder: (m) => {
        const shortBestFor = rec.bestFor && rec.bestFor.length < 60
          && !['trend over time', 'compare categories', 'part-to-whole'].some(g => rec.bestFor.toLowerCase().includes(g))
          ? rec.bestFor
          : undefined;

        switch (componentType) {
          case 'TimeseriesChart':
            return {
              title: shortBestFor || `${pluralizeEntity(shortEntityNoun(entity))} Over Time`,
              dateField: pickField(m, ['timestamp', 'created_at', 'started_at', 'date', 'time'], 'timestamp'),
              valueField: pickField(m, ['value', 'count', 'duration', 'cost', 'id'], 'value'),
              aggregation: 'count_per_interval',
            };
          case 'BarChart':
            return {
              title: shortBestFor || `${pluralizeEntity(shortEntityNoun(entity))} Breakdown`,
              dataKey: pickField(m, ['status', 'type', 'category', 'workflow_name', 'name'], 'status'),
              valueKey: 'count',
            };
          case 'PieChart':
          case 'DonutChart':
            return {
              title: shortBestFor || `${pluralizeEntity(shortEntityNoun(entity))} Distribution`,
              dataKey: pickField(m, ['status', 'type', 'category', 'workflow_name'], 'status'),
            };
          case 'DataTable':
            return {
              title: shortBestFor || `Recent ${pluralizeEntity(shortEntityNoun(entity))}`,
              columns: allFields.length > 0
                ? allFields.slice(0, 6).map(f => ({
                    key: f,
                    label: humanizeFieldName(f),
                  }))
                : [
                    { key: 'id', label: 'ID' },
                    { key: 'name', label: 'Name' },
                    { key: 'status', label: 'Status' },
                    { key: 'timestamp', label: 'Time' },
                  ],
              pageSize: 10,
            };
          case 'MetricCard':
            return {
              title: shortBestFor || `${shortEntityNoun(entity)} Count`,
              valueField: pickField(m, ['value', 'cost', 'amount', 'score', 'id'], 'id'),
              aggregation: 'count',
              icon: 'bar-chart-2',
            };
          default:
            return { title: shortBestFor || `${pluralizeEntity(shortEntityNoun(entity))} Overview`, field: 'status' };
        }
      },
      layout: { col: 0, row, w: width, h: 4 },
    });

    row += 4;
  }

  // FINAL ROW: Data table if none from recommendations
  if (!components.some(c => c.type === 'DataTable')) {
    components.push({
      id: 'activity-table',
      type: 'DataTable',
      propsBuilder: (m) => ({
        title: `Recent ${pluralizeEntity(shortEntityNoun(entity))}`,
        columns: allFields.length > 0
          ? allFields.slice(0, 6).map(f => ({
              key: f,
              label: humanizeFieldName(f),
            }))
          : [
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' },
              { key: 'timestamp', label: 'Time' },
            ],
        pageSize: 10,
      }),
      layout: { col: 0, row, w: 12, h: 4 },
    });
  }

  console.log(
    `[buildComponentsFromDesignTokens] Built ${components.length} LEGACY components ` +
    `from ${chartRecs.length} chart recommendations for "${entity}"`
  );

  return components;
}

// ============================================================================
// The tool itself
// ============================================================================
export const generateUISpec = createTool({
  id: 'generateUISpec',
  description:
    'Generates a full multi-component dashboard UI specification from template, mappings, and style bundle. ' +
    'Uses deterministic template blueprints with skill-aware design token resolution.',
  inputSchema: z.object({
    templateId: z.string(),
    mappings: z.record(z.string()),
    platformType: z.string(),
    selectedStyleBundleId: z.string().optional(),
    chartRecommendations: z.array(z.object({
      type: z.string(),
      bestFor: z.string(),
      fieldName: z.string().optional(),
    })).optional(),
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
    })).optional(),
    entityName: z.string().optional(),
    // ── Phase 2: Skeleton-aware inputs ──────────────────────────────
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
      layoutQuery: z.string(),
      summary: z.string(),
    }).optional(),
    designPatterns: z.array(z.object({
      content: z.string(),
      source: z.string(),
      score: z.number(),
    })).optional(),
    mode: z.enum(['internal', 'client-facing']).optional(),
    intent: z.string().optional(),
    uiType: z.enum([
      'dashboard', 'landing-page', 'form-wizard',
      'results-display', 'admin-crud', 'settings', 'auth',
    ]).optional(),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  execute: async (inputData, context) => {
    const { templateId, mappings, platformType } = inputData;

    // ── PRIORITY 1: Custom design tokens from RequestContext ──────────────────
    // If runDesignSystemWorkflow ran and persisted tokens, they're loaded into RC.
    // Use them directly — no preset resolution needed.
    const customTokensJson = context?.requestContext?.get('designTokens') as string;
    let styleTokens: typeof STYLE_BUNDLE_TOKENS[string];
    let styleBundleId: string;

    if (customTokensJson) {
      try {
        const custom = JSON.parse(customTokensJson);
        styleTokens = {
          colors: {
            primary: custom.colors.primary,
            secondary: custom.colors.secondary ?? custom.colors.primary,
            success: custom.colors.success ?? '#10B981',
            warning: custom.colors.warning ?? '#F59E0B',
            error: custom.colors.error ?? '#EF4444',
            background: custom.colors.background,
            text: custom.colors.text ?? '#0F172A',
          },
          fonts: {
            heading: custom.fonts?.heading ?? 'Inter, sans-serif',
            body: custom.fonts?.body ?? 'Inter, sans-serif',
          },
          spacing: custom.spacing ?? { unit: 8 },
          radius: custom.radius ?? 8,
          shadow: custom.shadow ?? 'soft',
        };
        styleBundleId = 'custom';
        console.log('[generateUISpec] Using CUSTOM tokens:', {
          primary: styleTokens.colors.primary,
          heading: styleTokens.fonts.heading,
        });
      } catch (parseErr) {
        console.error('[generateUISpec] Failed to parse custom tokens:', parseErr);
        throw new Error(
          'DESIGN_TOKENS_PARSE_FAILED: Custom design tokens exist in RequestContext but could not be parsed. ' +
          'This indicates a bug in runDesignSystemWorkflow token persistence. ' +
          'Raw value: ' + String(customTokensJson).slice(0, 200)
        );
      }
    } else {
      // NO CUSTOM TOKENS: This is an error, not a fallback scenario.
      // The designSystemWorkflow MUST run before generateUISpec.
      // Silently falling back to generic colors is what creates "made up" dashboards
      // that ignore the user's workflow context. Fail loudly so the agent retries.
      console.error('[generateUISpec] ❌ No custom design tokens in RequestContext. designSystemWorkflow must run first.');
      throw new Error(
        'DESIGN_TOKENS_MISSING: No custom design tokens found in RequestContext. ' +
        'The designSystemWorkflow must run and persist tokens before calling generateUISpec. ' +
        'This is a $100 premium service — every dashboard gets a unique, AI-generated design system.'
      );
    }

    // ── Extract chart recommendations from design tokens or input ────────
    let chartRecs = inputData.chartRecommendations;
    let entityName = inputData.entityName;

    // Try design tokens in RequestContext if not passed directly
    if (!chartRecs && customTokensJson) {
      try {
        const parsed = JSON.parse(customTokensJson);
        chartRecs = parsed.charts;
      } catch { /* ignore parse errors */ }
    }

    // Try entity name from RequestContext
    if (!entityName) {
      const selectedEntitiesRaw = context?.requestContext?.get('selectedEntities') as string;
      if (selectedEntitiesRaw) {
        try {
          const parsed = JSON.parse(selectedEntitiesRaw);
          if (Array.isArray(parsed)) {
            entityName = parsed[0]?.display_name || parsed[0]?.name;
          } else if (typeof parsed === 'object' && parsed !== null) {
            entityName = (parsed as { display_name?: string; name?: string }).display_name ||
              (parsed as { display_name?: string; name?: string }).name;
          }
        } catch {
          entityName = selectedEntitiesRaw.split(',')[0].trim() || undefined;
        }
      }
    }

    // Log entity name resolution for debugging
    console.log('[generateUISpec] Entity name resolution:', {
      fromInput: inputData.entityName || null,
      fromRequestContext: context?.requestContext?.get('selectedEntities') ? 'present' : 'absent',
      resolved: entityName || null,
      willFallbackTo: entityName ? 'entityName' : platformType ? 'platformType' : 'templateId',
    });

    // ── HARD FAIL: No chart recommendations = no dashboard ───────────────
    // The designSystemWorkflow MUST produce chart recommendations.
    // There are NO fallback templates. This is a premium service.
    if (!chartRecs || chartRecs.length === 0) {
      console.error('[generateUISpec] ❌ No chart recommendations. designSystemWorkflow must provide charts[].');
      throw new Error(
        'CHART_RECOMMENDATIONS_MISSING: No chart recommendations found in design tokens. ' +
        'The designSystemWorkflow must run and include a charts[] array with chart type recommendations. ' +
        'There are no fallback templates — every dashboard is custom-built from the design system.'
      );
    }

    // Build components from design system — every dashboard is unique
    // Fallback chain: entityName (from selectedEntities) → platformType → templateId
    // NEVER pass templateId raw (e.g. "workflow-dashboard") — it's a slug, not a label
    const resolvedEntityName = entityName || platformType || templateId;
    const fieldNames = Object.keys(mappings);

    // ── Phase 2: Skeleton-aware component building ──────────────────
    // Feature flag: Use ENABLE_SKELETON_LAYOUTS=true to activate.
    // Falls back to legacy buildComponentsFromDesignTokens() when disabled.
    const useSkeletons = process.env.ENABLE_SKELETON_LAYOUTS === 'true';
    let blueprints: ComponentBlueprint[];
    let skeletonId: SkeletonId | null = null;

    if (useSkeletons && inputData.dataSignals) {
      // Select skeleton deterministically from data signals
      const selectionContext: SelectionContext = {
        uiType: (inputData.uiType || 'dashboard') as UIType,
        dataShape: inputData.dataSignals as DataSignals,
        mode: inputData.mode || 'internal',
        platform: platformType,
        intent: inputData.intent || '',
      };
      skeletonId = selectSkeleton(selectionContext);
      const skeleton = getSkeleton(skeletonId);

      console.log(`[generateUISpec] Skeleton selected: "${skeletonId}" (${skeleton.name}) for ${platformType}`);

      // Route to the correct builder based on skeleton category
      if (skeleton.category === 'dashboard') {
        blueprints = buildDashboardComponentsFromSkeleton(
          skeleton,
          mappings,
          chartRecs as Array<{ type: string; bestFor: string; fieldName?: string }>,
          resolvedEntityName,
          inputData.fieldAnalysis,
          (inputData.designPatterns ?? []) as Array<{ content: string; source: string; score: number }>,
        );
      } else if (skeleton.category === 'product') {
        blueprints = buildProductComponentsFromSkeleton(skeleton, {
          entityName: resolvedEntityName,
          platformType,
          designPatterns: (inputData.designPatterns ?? []) as Array<{ content: string; source: string; score: number }>,
        });
      } else {
        blueprints = buildAdminComponentsFromSkeleton(skeleton, {
          entityName: resolvedEntityName,
          platformType,
          designPatterns: (inputData.designPatterns ?? []) as Array<{ content: string; source: string; score: number }>,
        });
      }
    } else {
      // LEGACY PATH: Fixed layout (pre-Phase 2)
      blueprints = buildComponentsFromDesignTokens(
        mappings,
        chartRecs as Array<{ type: string; bestFor: string; fieldName?: string }>,
        resolvedEntityName,
        inputData.fieldAnalysis,
      );
    }

    const components = blueprints.map(bp => ({
      id: bp.id,
      type: bp.type,
      props: bp.propsBuilder(mappings, fieldNames),
      layout: bp.layout,
    }));

    const parsedCustomForMeta = customTokensJson ? JSON.parse(customTokensJson) : {};
    const entity = cleanEntityName(resolvedEntityName);
    const skeleton = skeletonId ? getSkeleton(skeletonId) : null;

    const spec_json = {
      version: '1.0',
      templateId,
      platformType,
      styleBundleId,
      // Phase 2: Skeleton metadata
      ...(skeletonId ? {
        layoutSkeletonId: skeletonId,
        skeletonVersion: SKELETON_VERSION,
      } : {}),
      layout: {
        type: 'grid',
        columns: 12,
        gap: skeleton
          ? Math.max(skeleton.spacingPx, styleTokens.spacing.unit * 2)
          : Math.max(16, styleTokens.spacing.unit * 2),
      },
      components,
      metadata: {
        title: `${entity} Dashboard`,
        designTokens: {
          colors: styleTokens.colors,
          fonts: styleTokens.fonts,
        },
        styleName: parsedCustomForMeta.style?.name || parsedCustomForMeta.styleName || undefined,
        generatedAt: new Date().toISOString(),
        chartRecommendationsUsed: chartRecs,
        // Phase 2: Skeleton observability + Wolf V2: breakpoints for renderer
        ...(skeletonId ? {
          layoutSkeletonId: skeletonId,
          skeletonName: skeleton?.name,
          skeletonCategory: skeleton?.category,
          skeletonSpacing: skeleton?.spacing,
          skeletonVisualHierarchy: skeleton?.visualHierarchy,
          skeletonBreakpoints: skeleton?.breakpoints,
          designPatternsUsed: inputData.designPatterns?.length || 0,
        } : {}),
      },
    };

    // Design tokens resolved from the custom design system workflow
    // Include full style metadata so the preview page can display the style name
    const parsedCustom = customTokensJson ? JSON.parse(customTokensJson) : {};
    const design_tokens = {
      colors: styleTokens.colors,
      fonts: styleTokens.fonts,
      spacing: styleTokens.spacing,
      radius: styleTokens.radius,
      shadow: styleTokens.shadow,
      // Propagate style metadata from designSystemWorkflow (name, type, keywords, effects)
      ...(parsedCustom.style ? { style: parsedCustom.style } : {}),
      ...(parsedCustom.styleName ? { styleName: parsedCustom.styleName } : {}),
      // Propagate chart recommendations if present
      ...(parsedCustom.charts ? { charts: parsedCustom.charts } : {}),
      // Propagate UX guidelines if present
      ...(parsedCustom.uxGuidelines ? { uxGuidelines: parsedCustom.uxGuidelines } : {}),
    };

    console.log(
      `[generateUISpec] Generated ${components.length} components for template="${templateId}" style="${styleBundleId}" platform="${platformType}"`
    );

    return {
      spec_json,
      design_tokens,
    };
  },
});
