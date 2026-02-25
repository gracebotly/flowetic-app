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
// Wolf V2 Phase 3: STYLE_BUNDLE_TOKENS deleted.
// All design tokens come from designSystemWorkflow → CSV data.
// savePreviewVersion no longer imports this — it validates via layoutSkeletonId
// and known bundle ID allowlist instead.

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


/**
 * Map a chart recommendation type string to a component type.
 * Handles various naming conventions from the design system workflow.
 */
function mapChartRecType(recType: string): string {
  const t = recType.toLowerCase();
  if (t.includes('timeseries') || t.includes('line') || t.includes('area')) return 'TimeseriesChart';
  if (t.includes('bar')) return 'BarChart';
  if (t.includes('pie') || t.includes('donut')) return 'PieChart';
  if (t.includes('table')) return 'DataTable';
  return 'BarChart';
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

  // Wolf V2 Phase 3: Sanitize against HTML/JS injection in component IDs and titles.
  // Entity names flow into spec_json component IDs and dashboard titles — unsanitized
  // input like <script>alert(1)</script> would be dangerous in rendered previews.
  cleaned = cleaned
    .replace(/[<>'"&]/g, '')   // Remove HTML/JS injection chars
    .replace(/[{}()]/g, '')    // Remove template literal injection chars
    .substring(0, 100);        // Length limit to prevent abuse

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
 * Normalize wireframe component types to match skeleton builder types.
 * Wireframe uses lowercase like 'kpi', 'line_chart', 'pie_chart', 'table'.
 * Skeleton builder uses PascalCase like 'MetricCard', 'TimeseriesChart', 'PieChart', 'DataTable'.
 */
function normalizeWireframeType(wireframeType: string): string {
  const map: Record<string, string> = {
    'kpi': 'MetricCard',
    'metric': 'MetricCard',
    'line_chart': 'TimeseriesChart',
    'bar_chart': 'BarChart',
    'pie_chart': 'PieChart',
    'donut_chart': 'DonutChart',
    'table': 'DataTable',
    'data_table': 'DataTable',
    'funnel': 'BarChart',
    'timeline': 'TimeseriesChart',
    'status_grid': 'DataTable',
  };
  return map[wireframeType.toLowerCase()] || wireframeType;
}

/**
 * Map a design system chart recommendation type to a renderer component type.
 * Handles compound types like "Pie Chart or Donut" and "Bar Chart (Horizontal or Vertical)"
 * by checking for partial keyword matches when exact match fails.
 */

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
// Wolf V2 Phase 4: buildComponentsFromDesignTokens() deleted.
// All dashboards now use skeleton-based builders:
// - buildDashboardComponentsFromSkeleton() — for dashboard category
// - buildProductComponentsFromSkeleton() — for product category
// - buildAdminComponentsFromSkeleton() — for admin category
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

  // ── Bug 3 Fix: Track used chart fields to prevent duplicates ──────
  const usedChartFields = new Set<string>();
  let trendIndex = 0;
  let breakdownIndex = 0;
  const chartRecQueue = (chartRecs || [])
    .filter(r => r.fieldName)
    .map(r => ({ ...r }));
  let chartRecIndex = 0;

  for (const section of skeleton.sections) {
    const sectionHeight = section.minHeight || 2;

    switch (section.type) {
      case 'kpi-grid': {
        const maxKPIs = Math.min(section.maxItems || skeleton.maxKPIs, skeleton.maxKPIs);
        const kpiFields = [...heroes, ...supporting].slice(0, maxKPIs);
        if (kpiFields.length > 0) {
          const kpiWidth = Math.floor(12 / Math.min(kpiFields.length, maxKPIs));
          kpiFields.forEach((field, idx) => {
            // Bug 6 fix: Validate aggregation against field shape
            let safeAggregation = field.aggregation;
            if (safeAggregation === 'percentage' && field.shape === 'status' && field.uniqueValues <= 1) {
              // Single-value status field: percentage is meaningless, use count instead
              safeAggregation = 'count';
            }
            if (safeAggregation === 'avg' && (field.shape === 'status' || field.shape === 'label' || field.shape === 'id')) {
              // Can't average a string field
              safeAggregation = 'count';
            }
            components.push({
              id: `kpi-${idx}`,
              type: 'MetricCard',
              propsBuilder: (m) => ({
                title: humanizeFieldName(field.name),
                valueField: m[field.name] || field.name,
                aggregation: safeAggregation,
                icon: idx === 0 ? 'activity' : idx === 1 ? 'check-circle' : 'clock',
                variant: layoutHints.statusIndicators && field.shape === 'status' ? 'status-indicator' : 'default',
                showTrend: layoutHints.realTimeUpdates || false,
              }),
              layout: { col: idx * kpiWidth, row, w: kpiWidth, h: 2 },
            });
          });
        } else {
          const fallbackKPIs = [
            { title: `Total ${pluralizeEntity(shortEntityNoun(entity))}`, field: pickField(mappings, ['execution_id', 'run_id', 'id', 'call_id'], 'id'), agg: 'count', icon: 'activity' },
            { title: `${shortEntityNoun(entity)} Success Rate`, field: pickField(mappings, ['status', 'result', 'outcome'], 'status'), agg: 'count_distinct', icon: 'check-circle' },
            { title: 'Avg Duration', field: pickField(mappings, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'), agg: 'avg', icon: 'clock' },
          ].slice(0, skeleton.maxKPIs);
          const kpiWidth = Math.floor(12 / fallbackKPIs.length);
          fallbackKPIs.forEach((kpi, idx) => {
            components.push({
              id: `kpi-${idx}`,
              type: 'MetricCard',
              propsBuilder: () => ({ title: kpi.title, valueField: kpi.field, aggregation: kpi.agg, icon: kpi.icon }),
              layout: { col: idx * kpiWidth, row, w: kpiWidth, h: 2 },
            });
          });
        }
        row += 2; // KPIs always h:2 minimum for readable labels
        break;
      }
      case 'chart': {
        // If this section is <12 columns, check if there's a companion section
        // on the same row. If not, expand to full width to avoid orphaned gaps.
        let width = section.columns || 12;
        const sectionIdx = skeleton.sections.indexOf(section);
        const nextSection = skeleton.sections[sectionIdx + 1];
        const prevSection = sectionIdx > 0 ? skeleton.sections[sectionIdx - 1] : undefined;
        const hasCompanion = (nextSection && nextSection.type === 'chart' && (section.columns + (nextSection.columns || 12)) <= 12) ||
                             (prevSection && prevSection.type === 'chart' && (section.columns + (prevSection.columns || 12)) <= 12);
        if (!hasCompanion && width < 12) {
          width = 12; // Expand to full width when no side-by-side companion
        }
        const colStart = width < 12 ? (section.dominant ? 0 : (12 - width)) : 0;

        // ── Bug 3 Fix: Try to find an UNUSED trend or breakdown field ──
        let assignedTrend = false;
        while (trendIndex < trends.length) {
          const trendField = trends[trendIndex];
          trendIndex++;
          if (!usedChartFields.has(trendField.name)) {
            usedChartFields.add(trendField.name);
            components.push({
              id: `chart-trend-${row}`,
              type: 'TimeseriesChart',
              propsBuilder: (m) => ({
                title: `${humanizeFieldName(trendField.name)} Over Time`,
                // Primary fields for generateUISpec consumers
                xAxisField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
                yAxisField: 'count', // Bug 6 fix: y-axis should be a count/numeric value, not a timestamp
                aggregation: trendField.aggregation || 'count_per_interval',
                // Aliases that transformDataForComponents.enrichTimeseriesChart actually reads
                dateField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
                valueField: 'count',
                emphasisColor: layoutHints.emphasisColor || undefined,
                showLiveIndicator: layoutHints.realTimeUpdates || false,
              }),
              layout: { col: colStart, row, w: width, h: sectionHeight > 2 ? sectionHeight : 3 },
            });
            assignedTrend = true;
            break;
          }
        }

        if (!assignedTrend) {
          let assignedBreakdown = false;
          while (breakdownIndex < breakdowns.length) {
            const bdField = breakdowns[breakdownIndex];
            breakdownIndex++;
            if (!usedChartFields.has(bdField.name)) {
              usedChartFields.add(bdField.name);
              components.push({
                id: `chart-breakdown-${row}`,
                type: section.columns <= 6 ? 'PieChart' : 'BarChart',
                propsBuilder: (m) => ({
                  title: `${humanizeFieldName(bdField.name)} Distribution`,
                  categoryField: m[bdField.name] || bdField.name,
                  valueField: 'count',
                  aggregation: 'count',
                }),
                layout: { col: colStart, row, w: width, h: sectionHeight > 2 ? sectionHeight : 3 },
              });
              assignedBreakdown = true;
              break;
            }
          }

          if (!assignedBreakdown) {
            let assignedFromRec = false;
            while (chartRecIndex < chartRecQueue.length) {
              const rec = chartRecQueue[chartRecIndex];
              chartRecIndex++;
              if (rec.fieldName && !usedChartFields.has(rec.fieldName)) {
                usedChartFields.add(rec.fieldName);
                const chartType = mapChartRecType(rec.type);
                components.push({
                  id: `chart-rec-${row}`,
                  type: chartType,
                  propsBuilder: (m) => ({
                    title: rec.bestFor || `${humanizeFieldName(rec.fieldName!)} Chart`,
                    ...(chartType === 'TimeseriesChart'
                      ? {
                          xAxisField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
                          yAxisField: 'count',
                          aggregation: 'count_per_interval',
                          dateField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
                          valueField: 'count',
                        }
                      : {
                          categoryField: m[rec.fieldName!] || rec.fieldName,
                          valueField: 'count',
                          aggregation: 'count',
                        }),
                  }),
                  layout: { col: colStart, row, w: width, h: sectionHeight > 2 ? sectionHeight : 3 },
                });
                assignedFromRec = true;
                break;
              }
            }

            if (!assignedFromRec) {
              console.log(`[buildDashboardComponentsFromSkeleton] Skipping chart section "${section.id}" at row ${row} — all chart fields exhausted`);
            }
          }
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
        const feedType = layoutHints.realTimeUpdates ? 'StatusFeed' : 'DataTable';
        components.push({
          id: `feed-${row}`,
          type: feedType,
          propsBuilder: (m) => ({
            title: `Live ${shortEntityNoun(entity)} Feed`,
            columns: active.slice(0, 5).map(f => ({ key: f.name, label: humanizeFieldName(f.name) })),
            pageSize: 15,
            sortable: true,
            defaultSort: { field: pickField(m, ['timestamp', 'created_at', 'time'], 'timestamp'), direction: 'desc' },
            pollingInterval: layoutHints.realTimeUpdates ? 30000 : undefined,
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


  // ── Row compaction: eliminate gaps from unused skeleton sections ──
  // Sort by row, then reassign rows sequentially
  if (components.length > 0) {
    components.sort((a, b) => a.layout.row - b.layout.row || a.layout.col - b.layout.col);
    let currentRow = 0;
    let lastSeenRow = components[0].layout.row;
    let lastHeight = 0;
    for (const comp of components) {
      if (comp.layout.row !== lastSeenRow) {
        currentRow += lastHeight;
        lastSeenRow = comp.layout.row;
      }
      lastHeight = comp.layout.h;
      comp.layout.row = currentRow;
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
    // Bug 2 fix: Wireframe from selected proposal — used as layout template
    proposalWireframe: z.object({
      name: z.string().optional(),
      components: z.array(z.object({
        id: z.string(),
        type: z.string(),
        label: z.string().optional(),
        layout: z.object({
          col: z.number(),
          row: z.number(),
          w: z.number(),
          h: z.number(),
        }),
      })),
    }).optional(),
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
    let styleTokens: {
      colors: { primary: string; secondary: string; success: string; warning: string; error: string; background: string; text: string };
      fonts: { heading: string; body: string };
      spacing: { unit: number };
      radius: number;
      shadow: string;
    };
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

    // ── Wolf V2 Phase 4: Skeleton-aware component building ──────────
    // Skeletons are the ONLY path. Feature flag removed.
    // The legacy buildComponentsFromDesignTokens() function has been deleted.
    const useSkeletons = true;
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
      // Wolf V2 Phase 4: Legacy path removed. Skeletons are required.
      // If dataSignals is missing, use a default executive-overview skeleton.
      const fallbackContext: SelectionContext = {
        uiType: (inputData.uiType || 'dashboard') as UIType,
        dataShape: {
          fieldCount: Object.keys(mappings).length,
          hasTimestamp: false,
          hasTimeSeries: false,
          hasBreakdown: false,
          statusFields: 0,
          categoricalFields: 0,
          tableSuitableRatio: 1,
          eventDensity: 'low',
          dataStory: 'unknown',
          layoutQuery: 'executive overview',
          summary: 'Fallback skeleton context due to missing dataSignals.',
        } as DataSignals,
        mode: inputData.mode || 'internal',
        platform: platformType,
        intent: inputData.intent || '',
      };
      skeletonId = selectSkeleton(fallbackContext);
      const skeleton = getSkeleton(skeletonId);
      console.log(`[generateUISpec] Fallback skeleton selected: "${skeletonId}" (no dataSignals provided)`);
      blueprints = buildDashboardComponentsFromSkeleton(
        skeleton,
        mappings,
        chartRecs as Array<{ type: string; bestFor: string; fieldName?: string }>,
        resolvedEntityName,
        inputData.fieldAnalysis,
        (inputData.designPatterns ?? []) as Array<{ content: string; source: string; score: number }>,
      );
    }

    const rawComponents = blueprints.map(bp => ({
      id: bp.id,
      type: bp.type,
      props: bp.propsBuilder(mappings, fieldNames),
      layout: bp.layout,
    }));

    // ── Bug 3 Fix: Final deduplication safety net ──────────────────
    // Remove any components that ended up with identical (type, primary-field) tuples
    const seenChartSignatures = new Set<string>();
    const components = rawComponents.filter(c => {
      if (!['TimeseriesChart', 'BarChart', 'PieChart', 'LineChart'].includes(c.type)) {
        return true;
      }
      const props = c.props as Record<string, unknown>;
      const primaryField = (props.yAxisField || props.categoryField || props.valueField || c.id) as string;
      const signature = `${c.type}::${primaryField}`;
      if (seenChartSignatures.has(signature)) {
        console.log(`[generateUISpec] Dedup: removing duplicate chart ${c.id} (${signature})`);
        return false;
      }
      seenChartSignatures.add(signature);
      return true;
    });

    // ── Bug 2 Fix: Override layout positions from proposal wireframe ────
    // If the user selected a proposal with a wireframe, use those positions
    // as the component grid layout instead of the skeleton-generated positions.
    const proposalWireframe = inputData.proposalWireframe;
    if (proposalWireframe?.components?.length) {
      console.log(`[generateUISpec] Applying proposal wireframe layout: "${proposalWireframe.name}" (${proposalWireframe.components.length} wireframe slots)`);

      // Build a map from wireframe component type → wireframe layout
      // Match skeleton-generated components to wireframe slots by type
      const wireframeSlots = [...proposalWireframe.components];
      const typeMap: Record<string, typeof wireframeSlots> = {};
      for (const slot of wireframeSlots) {
        // Normalize wireframe types to match component types
        const normalizedType = normalizeWireframeType(slot.type);
        if (!typeMap[normalizedType]) typeMap[normalizedType] = [];
        typeMap[normalizedType].push(slot);
      }

      for (const comp of components) {
        const normalizedCompType = normalizeWireframeType(comp.type);
        const matchingSlots = typeMap[normalizedCompType];
        if (matchingSlots && matchingSlots.length > 0) {
          const slot = matchingSlots.shift()!; // consume the slot
          comp.layout = {
            col: slot.layout.col,
            row: slot.layout.row,
            w: slot.layout.w,
            h: slot.layout.h,
          };
        }
      }
    }

    const specLayoutHints = extractLayoutHints(
      (inputData.designPatterns ?? []) as Array<{ content: string; source: string; score: number }>
    );

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
        preferDarkMode: specLayoutHints.preferDarkMode || false,
        realTimeUpdates: specLayoutHints.realTimeUpdates || false,
        statusIndicators: specLayoutHints.statusIndicators || false,
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
