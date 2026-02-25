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
// Wireframe-Based Component Builder
// Uses the proposal wireframe (user's selected layout) as the grid template.
// Each wireframe component slot is matched to real data via field analysis
// and chart recommendations.
// ============================================================================

function buildComponentsFromWireframe(
  wireframe: { name?: string; components: Array<{ id: string; type: string; label?: string; layout: { col: number; row: number; w: number; h: number } }> },
  mappings: Record<string, string>,
  chartRecs: Array<{ type: string; bestFor: string; fieldName?: string }>,
  entityName: string,
  fieldAnalysis?: Array<{
    name: string; type: string; shape: string; component: string;
    aggregation: string; role: string; uniqueValues: number;
    totalRows: number; skip: boolean; skipReason?: string;
  }>,
): ComponentBlueprint[] {
  const blueprints: ComponentBlueprint[] = [];
  const allFields = Object.keys(mappings);
  const usedFields = new Set<string>();

  // Classify fields from fieldAnalysis
  const active = (fieldAnalysis || []).filter(f => !f.skip);
  const heroes = active.filter(f => f.role === 'hero' || f.shape === 'duration' || f.shape === 'money' || f.shape === 'rate');
  const trends = active.filter(f => f.shape === 'timestamp' || f.component === 'TimeseriesChart');
  const breakdowns = active.filter(f => f.shape === 'label' || f.shape === 'status' || f.component === 'PieChart' || f.component === 'BarChart');

  let kpiIndex = 0;
  let trendIndex = 0;
  let breakdownIndex = 0;
  let chartRecIndex = 0;

  for (const slot of wireframe.components) {
    const normalizedType = slot.type.toLowerCase().replace(/[-_\s]/g, '');
    const layout = { ...slot.layout };

    if (normalizedType === 'kpi' || normalizedType === 'metriccard' || normalizedType === 'kpicard') {
      // ── KPI slot: match to hero field or use fallback ──
      const heroField = heroes[kpiIndex];
      kpiIndex++;

      if (heroField && !usedFields.has(heroField.name)) {
        usedFields.add(heroField.name);
        blueprints.push({
          id: slot.id,
          type: 'MetricCard',
          propsBuilder: (m) => ({
            title: slot.label || humanizeFieldName(heroField.name),
            valueField: m[heroField.name] || heroField.name,
            aggregation: heroField.aggregation || 'count',
            icon: heroField.shape === 'duration' ? 'clock' : heroField.shape === 'status' ? 'check-circle' : 'activity',
          }),
          layout,
        });
      } else {
        // Fallback KPI from common patterns
        const fallbacks = [
          { title: `Total ${pluralizeEntity(shortEntityNoun(cleanEntityName(entityName)))}`, field: pickField(mappings, ['execution_id', 'run_id', 'id', 'call_id'], 'id'), agg: 'count', icon: 'activity' },
          { title: 'Success Rate', field: pickField(mappings, ['status', 'result', 'outcome'], 'status'), agg: 'percentage', icon: 'check-circle' },
          { title: 'Avg Duration', field: pickField(mappings, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'), agg: 'avg', icon: 'clock' },
          { title: 'Runs Over Time', field: pickField(mappings, ['timestamp', 'created_at', 'started_at'], 'timestamp'), agg: 'count', icon: 'trending' },
        ];
        const fb = fallbacks[(kpiIndex - 1) % fallbacks.length];
        blueprints.push({
          id: slot.id,
          type: 'MetricCard',
          propsBuilder: () => ({
            title: slot.label || fb.title,
            valueField: fb.field,
            aggregation: fb.agg,
            icon: fb.icon,
          }),
          layout,
        });
      }

    } else if (normalizedType === 'linechart' || normalizedType === 'timeserieschart' || normalizedType === 'areachart') {
      // ── Timeseries slot ──
      const trendField = trends[trendIndex];
      trendIndex++;
      const dateField = pickField(mappings, ['timestamp', 'created_at', 'started_at', 'ended_at', 'time', 'date'], 'timestamp');

      blueprints.push({
        id: slot.id,
        type: 'TimeseriesChart',
        propsBuilder: () => ({
          title: slot.label || (trendField ? `${humanizeFieldName(trendField.name)} Over Time` : 'Activity Over Time'),
          xAxisField: dateField,
          yAxisField: 'count',
          aggregation: 'count_per_interval',
          dateField,
          valueField: 'count',
        }),
        layout,
      });

    } else if (normalizedType === 'barchart') {
      // ── Bar chart slot ──
      const bdField = breakdowns[breakdownIndex] || null;
      if (bdField) {
        breakdownIndex++;
        usedFields.add(bdField.name);
      }
      const catField = bdField
        ? (mappings[bdField.name] || bdField.name)
        : pickField(mappings, ['workflow_name', 'workflow_id', 'status', 'type'], 'status');

      blueprints.push({
        id: slot.id,
        type: 'BarChart',
        propsBuilder: () => ({
          title: slot.label || (bdField ? `${humanizeFieldName(bdField.name)} Breakdown` : 'Breakdown by Type'),
          categoryField: catField,
          valueField: 'count',
          aggregation: 'count',
        }),
        layout,
      });

    } else if (normalizedType === 'piechart' || normalizedType === 'donutchart') {
      // ── Pie/Donut chart slot ──
      const bdField = breakdowns[breakdownIndex] || null;
      if (bdField) {
        breakdownIndex++;
        usedFields.add(bdField.name);
      }
      const catField = bdField
        ? (mappings[bdField.name] || bdField.name)
        : pickField(mappings, ['status', 'workflow_name', 'type'], 'status');

      blueprints.push({
        id: slot.id,
        type: 'PieChart',
        propsBuilder: () => ({
          title: slot.label || (bdField ? `${humanizeFieldName(bdField.name)} Distribution` : 'Status Distribution'),
          categoryField: catField,
          valueField: 'count',
          aggregation: 'count',
        }),
        layout,
      });

    } else if (normalizedType === 'table' || normalizedType === 'datatable' || normalizedType === 'statusgrid') {
      // ── Table/grid slot ──
      const tableColumns = active.length > 0
        ? active.slice(0, 8).map(f => ({ key: f.name, label: humanizeFieldName(f.name) }))
        : allFields.slice(0, 6).map(f => ({ key: f, label: humanizeFieldName(f) }));

      blueprints.push({
        id: slot.id,
        type: slot.type.toLowerCase().includes('status') ? 'StatusFeed' : 'DataTable',
        propsBuilder: (m) => ({
          title: slot.label || `${shortEntityNoun(cleanEntityName(entityName))} Details`,
          columns: tableColumns,
          pageSize: 15,
          sortable: true,
          defaultSort: { field: pickField(m, ['timestamp', 'created_at', 'time'], 'timestamp'), direction: 'desc' },
        }),
        layout,
      });

    } else {
      // ── Unknown type: try chart recommendations ──
      const rec = chartRecs[chartRecIndex];
      if (rec) {
        chartRecIndex++;
        const chartType = mapChartRecType(rec.type);
        blueprints.push({
          id: slot.id,
          type: chartType,
          propsBuilder: (m) => ({
            title: slot.label || rec.bestFor || 'Chart',
            ...(chartType === 'TimeseriesChart'
              ? {
                  xAxisField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
                  yAxisField: 'count',
                  aggregation: 'count_per_interval',
                  dateField: pickField(m, ['timestamp', 'created_at', 'time', 'date'], 'timestamp'),
                  valueField: 'count',
                }
              : {
                  categoryField: rec.fieldName ? (m[rec.fieldName] || rec.fieldName) : pickField(m, ['status', 'type'], 'status'),
                  valueField: 'count',
                  aggregation: 'count',
                }),
          }),
          layout,
        });
      } else {
        console.log(`[buildComponentsFromWireframe] Unknown slot type "${slot.type}" and no chart recs left — skipping ${slot.id}`);
      }
    }
  }

  return blueprints;
}

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

              // ── Gap-fill: Expand companion component to fill the empty space ──
              // If this section was supposed to be side-by-side with another chart
              // (e.g., status-distribution[5] + trend-throughput[7]), and we're
              // skipping this one, find the companion component on the same row
              // and expand it to full width so there's no half-empty row.
              if (width < 12) {
                const companionOnSameRow = components.find(
                  c => c.layout.row === row && c.id !== `chart-trend-${row}` && c.id !== `chart-breakdown-${row}` && c.id !== `chart-rec-${row}`
                );
                if (companionOnSameRow) {
                  console.log(`[buildDashboardComponentsFromSkeleton] Expanding companion "${companionOnSameRow.id}" to full width (was col:${companionOnSameRow.layout.col} w:${companionOnSameRow.layout.w})`);
                  companionOnSameRow.layout.col = 0;
                  companionOnSameRow.layout.w = 12;
                } else {
                  // Check if the NEXT section is a companion that hasn't been built yet.
                  // Mark this row as needing full-width expansion for the next chart section.
                  const sIdx = skeleton.sections.indexOf(section);
                  const nxtSection = skeleton.sections[sIdx + 1];
                  if (nxtSection && nxtSection.type === 'chart' && (section.columns + (nxtSection.columns || 12)) <= 12) {
                    // The next section will be built on the same row — it should go full width.
                    // We signal this by NOT incrementing row, so the next section reuses this row.
                    // Also override its width by storing a flag.
                    console.log(`[buildDashboardComponentsFromSkeleton] Next section "${nxtSection.id}" will expand to fill row ${row}`);
                    // Don't increment row — let the companion section reuse it
                    // The companion will detect hasCompanion=true but since we skipped,
                    // we need to mark that this section was empty.
                    // Simplest fix: just skip row increment and let companion take full row
                    break; // exit case — don't increment row
                  }
                }
              }
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

  // ── Post-process: skeleton-aware gap handling ─────────────────────
  // When a paired section's companion is missing (skipped due to insufficient
  // data), we DON'T blindly expand to w:12. Instead:
  //
  // 1. Chart components in a pair: the remaining chart expands to fill
  //    the pair's combined width (preserves the skeleton's row structure).
  // 2. KPI grids: already span full width, no adjustment needed.
  // 3. Tables/feeds: already span full width, no adjustment needed.
  // 4. Two components in a row that don't sum to 12: the wider one absorbs
  //    the gap (preserves asymmetric intent).
  //
  // CRITICAL: We ONLY expand charts to 8 columns max (not 12) when they were
  // part of a side-by-side pair. A 12-col chart looks like a bland full-width
  // block — an 8-col chart with whitespace looks intentional and premium.
  const rowMap = new Map<number, ComponentBlueprint[]>();
  for (const c of components) {
    const r = c.layout.row;
    if (!rowMap.has(r)) rowMap.set(r, []);
    rowMap.get(r)!.push(c);
  }
  for (const [, rowComps] of rowMap) {
    if (rowComps.length === 1) {
      const comp = rowComps[0];
      if (comp.layout.w < 12) {
        // Determine if this is a chart that was part of a skeleton pair
        const isChart = comp.type === 'TimeseriesChart' || comp.type === 'BarChart' ||
                        comp.type === 'PieChart' || comp.type === 'LineChart' ||
                        comp.type === 'DonutChart' || comp.type === 'AreaChart';
        const isSmallChart = isChart && comp.layout.w <= 6;

        if (isSmallChart) {
          // Expand to 8 cols (not 12) — leaves intentional whitespace for premium feel
          const newW = Math.min(8, 12);
          console.log(`[buildDashboardComponentsFromSkeleton] Post-process: expanding lone chart "${comp.id}" from col:${comp.layout.col} w:${comp.layout.w} → col:0 w:${newW} (capped, not full-width)`);
          comp.layout.col = 0;
          comp.layout.w = newW;
        } else if (isChart && comp.layout.w >= 7) {
          // Already a dominant chart (7+ cols) — expand to full width is OK
          console.log(`[buildDashboardComponentsFromSkeleton] Post-process: expanding dominant chart "${comp.id}" from col:${comp.layout.col} w:${comp.layout.w} → col:0 w:12`);
          comp.layout.col = 0;
          comp.layout.w = 12;
        } else {
          // Non-chart (StatusFeed, InsightCard, etc.) — expand to full width
          console.log(`[buildDashboardComponentsFromSkeleton] Post-process: expanding lone component "${comp.id}" from col:${comp.layout.col} w:${comp.layout.w} → col:0 w:12`);
          comp.layout.col = 0;
          comp.layout.w = 12;
        }
      }
    } else if (rowComps.length === 2) {
      // Two components in a row — ensure they fill the full 12 columns
      const totalW = rowComps.reduce((sum, c) => sum + c.layout.w, 0);
      if (totalW < 12) {
        // Expand the dominant (wider) component to fill the gap
        const sorted = [...rowComps].sort((a, b) => b.layout.w - a.layout.w);
        const gap = 12 - totalW;
        sorted[0].layout.w += gap;
        // Recalculate col positions
        rowComps.sort((a, b) => a.layout.col - b.layout.col);
        let col = 0;
        for (const c of rowComps) {
          c.layout.col = col;
          col += c.layout.w;
        }
      }
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
    preferWireframe: z.boolean().optional().describe('When true, use the proposal wireframe instead of skeletons for layout. Default: false (skeletons are preferred for premium layouts).'),
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
      colors: { primary: string; secondary: string; accent?: string; success: string; warning: string; error: string; background: string; surface?: string; text: string; muted?: string };
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
            accent: custom.colors.accent ?? custom.colors.secondary ?? custom.colors.primary,
            success: custom.colors.success ?? '#10B981',
            warning: custom.colors.warning ?? '#F59E0B',
            error: custom.colors.error ?? '#EF4444',
            background: custom.colors.background,
            surface: custom.colors.surface ?? undefined,
            text: custom.colors.text ?? '#0F172A',
            muted: custom.colors.muted ?? undefined,
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

    // ── Layout Priority: Skeleton > Proposal Wireframe ──────────────
    // Skeletons are the premium build system (11 deterministic layouts with
    // responsive breakpoints, visual hierarchy, and 8-12 components).
    // Wireframes are lightweight sketches used for proposal card thumbnails.
    // Always use skeletons for the actual dashboard build unless explicitly
    // opted out via preferWireframe flag.
    let blueprints: ComponentBlueprint[];
    let skeletonId: SkeletonId | null = null;
    let usedWireframe = false;

    const preferWireframe = inputData.preferWireframe === true;
    const hasWireframe = !!inputData.proposalWireframe?.components?.length;

    if (preferWireframe && hasWireframe) {
      // ── OPT-IN PATH: Build from proposal wireframe (only when explicitly requested) ──
      const wireframe = inputData.proposalWireframe!;
      console.log(`[generateUISpec] preferWireframe=true — using proposal wireframe "${wireframe.name}" with ${wireframe.components.length} components as layout source`);

      blueprints = buildComponentsFromWireframe(
        wireframe,
        mappings,
        chartRecs as Array<{ type: string; bestFor: string; fieldName?: string }>,
        resolvedEntityName,
        inputData.fieldAnalysis,
      );
      usedWireframe = true;
      console.log(`[generateUISpec] Wireframe produced ${blueprints.length} component blueprints`);

    } else {
      if (hasWireframe && !preferWireframe) {
        console.log('[generateUISpec] Proposal wireframe exists but preferWireframe=false — using skeleton system for premium layout');
      }
      // ── FALLBACK PATH: Skeleton selection ──────────────────────────
      console.log('[generateUISpec] No proposal wireframe — falling back to skeleton selection');
      const useSkeletons = true;
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
    } // end of skeleton fallback else-block

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

    console.log(`[generateUISpec] Layout source: ${usedWireframe ? 'proposal wireframe' : 'skeleton'}`);

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
          // Deep-clone breakpoints to guarantee clean JSON serialization.
          // Without this, object references can serialize as null in some
          // edge cases (e.g., when spec_json passes through Supabase JSONB round-trip).
          skeletonBreakpoints: skeleton?.breakpoints
            ? JSON.parse(JSON.stringify(skeleton.breakpoints))
            : null,
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
