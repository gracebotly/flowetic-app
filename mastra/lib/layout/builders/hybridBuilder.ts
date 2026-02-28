// mastra/lib/layout/builders/hybridBuilder.ts
//
// Skeleton-aware component builder for the "record-browser" (L) skeleton.
// Emits ComponentBlueprint[] for record-oriented data (rich text, nested objects,
// field groups with mixed null rates).
//
// Component types emitted: MetricCard, RecordList, ContentCard, FilteredChart, DataTable
// NOTE: ContentCard, RecordList, FilteredChart are NEW component types.
//       Phase 4 will create their React renderers + enrichment functions.
//       This builder emits their blueprints now so the spec is correct.
//
// Architecture:
//   - summary-kpis slot    → 3-4 MetricCard components (total records, success rate, avg duration)
//   - record-list slot     → 1 RecordList component (browsable record table with grouped fields)
//   - content-detail slot  → 1 ContentCard component (first rich_text field)
//   - filtered-charts slot → up to 2 FilteredChart wrappers (non-sparse categorical fields)

import type { LayoutSkeleton } from '../skeletons';

// ============================================================================
// Types (mirrors ComponentBlueprint from generateUISpec.ts)
// ============================================================================

interface ComponentBlueprint {
  id: string;
  type: string;
  propsBuilder: (mappings: Record<string, string>, fields: string[]) => Record<string, unknown>;
  layout: { col: number; row: number; w: number; h: number };
  meta?: {
    reason?: string;
    source?: string;
    fieldShape?: string;
    fieldName?: string;
    skeletonSlot?: string;
  };
}

// ============================================================================
// Field Analysis Input (subset used by this builder)
// ============================================================================

interface FieldAnalysisInput {
  name: string;
  type: string;
  shape: string;
  component: string;
  aggregation: string;
  role: string;
  uniqueValues: number;
  totalRows: number;
  skip: boolean;
  skipReason?: string;
  semanticSource?: string;
  references?: string;
  displayName?: string;
  fieldGroup?: string;
  sparseField?: boolean;
  nullRate?: number;
}

// ============================================================================
// Data Signals Input (subset used by this builder)
// ============================================================================

interface DataSignalsInput {
  dataDisplayMode: 'metrics' | 'records' | 'hybrid';
  richTextFields: string[];
  fieldGroups: Array<{
    prefix: string;
    fields: string[];
    avgNullRate: number;
  }>;
  sparseFields: string[];
}

// ============================================================================
// Helper: humanize field names (mirrors generateUISpec.ts helper)
// ============================================================================

function humanizeFieldName(raw: string): string {
  const FIELD_LABEL_MAP: Record<string, string> = {
    'execution_id': 'Executions', 'run_id': 'Runs', 'workflow_id': 'Workflow',
    'call_id': 'Calls', 'id': 'Records', 'duration_ms': 'Duration',
    'duration': 'Duration', 'started_at': 'Started', 'ended_at': 'Ended',
    'created_at': 'Created', 'timestamp': 'Time', 'status': 'Status',
    'result': 'Result', 'outcome': 'Outcome', 'error_message': 'Errors',
    'workflow_name': 'Workflow', 'scenario_name': 'Scenario',
  };
  const lower = raw.toLowerCase();
  if (FIELD_LABEL_MAP[lower]) return FIELD_LABEL_MAP[lower];

  return raw
    .replace(/_ms$/i, '').replace(/_id$/i, '').replace(/_at$/i, '')
    .replace(/_url$/i, '').replace(/_count$/i, '').replace(/_num$/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim() || raw;
}

/**
 * Pick the best field from mappings, falling back through preferred keys.
 * Mirrors the pickField() helper in generateUISpec.ts.
 */
function pickField(
  mappings: Record<string, string>,
  preferredKeys: string[],
  fallback: string,
): string {
  for (const key of preferredKeys) {
    if (mappings[key]) return mappings[key];
  }
  const mappingKeys = Object.keys(mappings);
  for (const key of preferredKeys) {
    const found = mappingKeys.find(k => k.toLowerCase().includes(key.toLowerCase()));
    if (found && mappings[found]) return mappings[found];
  }
  for (const key of preferredKeys) {
    const found = Object.values(mappings).find(v => v.toLowerCase().includes(key.toLowerCase()));
    if (found) return found;
  }
  return fallback;
}

/**
 * Smart entity noun for titles (mirrors generateUISpec.ts).
 */
function shortEntityNoun(cleanedEntity: string): string {
  const words = cleanedEntity.trim().split(/\s+/);
  if (words.length <= 3) return cleanedEntity;
  return 'Run';
}

function pluralizeEntity(word: string): string {
  if (!word) return 'Items';
  if (word.length <= 4 && !/\s/.test(word)) return word + ' Runs';
  const lower = word.toLowerCase();
  if (lower.endsWith('s')) return word;
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (lower.endsWith('sh') || lower.endsWith('ch') || lower.endsWith('x') || lower.endsWith('z')) return word + 'es';
  return word + 's';
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build record-oriented component specs for the record-browser skeleton.
 *
 * This builder is called by generateUISpec.ts when skeletonId === 'record-browser'.
 * It emits ComponentBlueprint[] that follow the same contract as
 * buildDashboardComponentsFromSkeleton().
 *
 * Section mapping:
 *   summary-kpis    (kpi-grid)     → MetricCard × 3-4
 *   record-list     (record-list)  → RecordList × 1
 *   content-detail  (content-panel)→ ContentCard × 1 (or skipped if no rich_text)
 *   filtered-charts (chart-grid)   → FilteredChart × 0-2
 */
export function buildHybridComponentsFromSkeleton(
  skeleton: LayoutSkeleton,
  mappings: Record<string, string>,
  chartRecs: Array<{ type: string; bestFor: string; fieldName?: string }>,
  entityName: string,
  fieldAnalysis?: FieldAnalysisInput[],
  dataSignals?: DataSignalsInput,
): ComponentBlueprint[] {
  const blueprints: ComponentBlueprint[] = [];
  let row = 0;

  // ── Classify fields from fieldAnalysis ────────────────────────────
  const active = (fieldAnalysis || []).filter(f => !f.skip);
  const heroes = active.filter(f =>
    f.role === 'hero' || f.shape === 'duration' || f.shape === 'money' || f.shape === 'rate',
  );
  const richTextFields = active.filter(f => f.shape === 'rich_text');
  const nonSparseCategories = active.filter(f =>
    (f.shape === 'label' || f.shape === 'status' || f.shape === 'binary') &&
    !f.sparseField &&
    f.uniqueValues >= 2 &&
    f.uniqueValues <= 20,
  );

  // ── Field groups for RecordList column grouping ───────────────────
  const fieldGroups = dataSignals?.fieldGroups || [];

  const entity = entityName
    .replace(/[<>'"&{}()]/g, '')
    .substring(0, 100) || 'Dashboard';

  console.log(
    `[hybridBuilder] Building record-browser for "${entity}": ` +
    `${active.length} active fields, ${heroes.length} heroes, ` +
    `${richTextFields.length} rich_text, ${nonSparseCategories.length} categorical, ` +
    `${fieldGroups.length} field groups`,
  );

  // ── Section 1: summary-kpis (kpi-grid) ────────────────────────────
  const kpiSection = skeleton.sections.find(s => s.id === 'summary-kpis');
  if (kpiSection) {
    const maxKPIs = kpiSection.maxItems || skeleton.maxKPIs || 4;

    if (heroes.length > 0) {
      // Use real hero fields from field analysis
      const kpiFields = heroes.slice(0, maxKPIs);
      const kpiWidth = Math.floor(12 / kpiFields.length);

      kpiFields.forEach((field, idx) => {
        const safeAgg = field.aggregation === 'count_per_category' ? 'count' : field.aggregation;
        blueprints.push({
          id: `kpi-${idx}`,
          type: 'MetricCard',
          propsBuilder: (m) => ({
            title: field.displayName || humanizeFieldName(field.name),
            valueField: m[field.name] || field.name,
            aggregation: safeAgg,
            icon: field.shape === 'duration' ? 'clock'
              : field.shape === 'money' ? 'dollar-sign'
              : field.shape === 'rate' ? 'trending-up'
              : field.shape === 'status' ? 'check-circle'
              : 'activity',
          }),
          layout: { col: idx * kpiWidth, row, w: kpiWidth, h: 2 },
          meta: {
            reason: `Record-browser KPI from field "${field.name}" (${field.shape})`,
            source: 'workflow',
            fieldShape: field.shape,
            fieldName: field.name,
            skeletonSlot: 'summary-kpis',
          },
        });
      });
    } else {
      // Fallback KPIs: total records, success rate, avg duration
      const fallbackKPIs = [
        {
          title: `Total ${pluralizeEntity(shortEntityNoun(entity))}`,
          field: pickField(mappings, ['execution_id', 'run_id', 'id', 'call_id'], 'id'),
          agg: 'count',
          icon: 'activity',
        },
        {
          title: 'Success Rate',
          field: pickField(mappings, ['status', 'result', 'outcome'], 'status'),
          agg: 'percentage',
          icon: 'check-circle',
        },
        {
          title: 'Avg Duration',
          field: pickField(mappings, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'),
          agg: 'avg',
          icon: 'clock',
        },
      ].slice(0, maxKPIs);

      const kpiWidth = Math.floor(12 / fallbackKPIs.length);
      fallbackKPIs.forEach((kpi, idx) => {
        blueprints.push({
          id: `kpi-${idx}`,
          type: 'MetricCard',
          propsBuilder: () => ({
            title: kpi.title,
            valueField: kpi.field,
            aggregation: kpi.agg,
            icon: kpi.icon,
          }),
          layout: { col: idx * kpiWidth, row, w: kpiWidth, h: 2 },
          meta: {
            reason: 'Record-browser fallback KPI',
            source: 'workflow',
            skeletonSlot: 'summary-kpis',
          },
        });
      });
    }

    row += 2;
  }

  // ── Section 2: record-list (dominant) ─────────────────────────────
  const recordListSection = skeleton.sections.find(s => s.id === 'record-list');
  if (recordListSection) {
    // Build column definitions from ALL active fields, grouped by fieldGroup
    const columns = active.slice(0, 12).map(f => ({
      key: f.name,
      label: f.displayName || humanizeFieldName(f.name),
      group: f.fieldGroup || undefined,
      shape: f.shape,
    }));

    // Separate input/output field groups for the RecordList's grouped display
    const inputGroup = fieldGroups.find(g =>
      g.prefix.toLowerCase().includes('input') ||
      g.prefix.toLowerCase().includes('request') ||
      g.prefix.toLowerCase().includes('query'),
    );
    const outputGroup = fieldGroups.find(g =>
      g.prefix.toLowerCase().includes('output') ||
      g.prefix.toLowerCase().includes('response') ||
      g.prefix.toLowerCase().includes('result') ||
      g.prefix.toLowerCase().includes('research'),
    );

    blueprints.push({
      id: 'record-list',
      type: 'RecordList',
      propsBuilder: (m) => ({
        title: `${shortEntityNoun(entity)} Records`,
        columns,
        pageSize: 10,
        sortable: true,
        expandable: true,
        defaultSort: {
          field: pickField(m, ['timestamp', 'created_at', 'started_at', 'time'], 'timestamp'),
          direction: 'desc' as const,
        },
        // Field group metadata for grouped column display
        fieldGroups: {
          input: inputGroup ? inputGroup.fields : [],
          output: outputGroup ? outputGroup.fields : [],
        },
      }),
      layout: { col: 0, row, w: 12, h: recordListSection.minHeight || 5 },
      meta: {
        reason: `Record browser — browsable list of ${active.length} fields across ${fieldGroups.length} groups`,
        source: 'workflow',
        fieldShape: 'record-list',
        skeletonSlot: 'record-list',
      },
    });

    row += recordListSection.minHeight || 5;
  }

  // ── Section 3: content-detail (content-panel) ─────────────────────
  const contentSection = skeleton.sections.find(s => s.id === 'content-detail');
  if (contentSection) {
    const firstRichText = richTextFields[0];

    if (firstRichText) {
      blueprints.push({
        id: 'content-detail',
        type: 'ContentCard',
        propsBuilder: (m) => ({
          title: firstRichText.displayName || humanizeFieldName(firstRichText.name),
          contentField: m[firstRichText.name] || firstRichText.name,
          aggregation: 'none',
          renderAs: 'rich-text',
          maxHeight: 400,
        }),
        layout: { col: 0, row, w: 12, h: contentSection.minHeight || 4 },
        meta: {
          reason: `Rich text content from field "${firstRichText.name}" (shape: rich_text)`,
          source: 'workflow',
          fieldShape: 'rich_text',
          fieldName: firstRichText.name,
          skeletonSlot: 'content-detail',
        },
      });

      row += contentSection.minHeight || 4;
    } else {
      // No rich text field — skip this section entirely
      console.log(
        '[hybridBuilder] No rich_text field found — skipping content-detail section',
      );
    }
  }

  // ── Section 4: filtered-charts (chart-grid) ───────────────────────
  const chartSection = skeleton.sections.find(s => s.id === 'filtered-charts');
  if (chartSection) {
    const maxCharts = chartSection.maxItems || skeleton.maxSecondaryCharts || 2;

    // Pick top non-sparse categorical fields for charts
    const chartFields = nonSparseCategories.slice(0, maxCharts);

    if (chartFields.length > 0) {
      const chartWidth = Math.floor(12 / chartFields.length);

      chartFields.forEach((field, idx) => {
        blueprints.push({
          id: `filtered-chart-${idx}`,
          type: 'FilteredChart',
          propsBuilder: (m) => ({
            title: `${humanizeFieldName(field.name)} Distribution`,
            categoryField: m[field.name] || field.name,
            valueField: 'count',
            aggregation: 'count',
            // FilteredChart wraps a standard chart but filters out null rows first
            innerChartType: field.uniqueValues <= 6 ? 'PieChart' : 'BarChart',
            filterNulls: true,
          }),
          layout: { col: idx * chartWidth, row, w: chartWidth, h: chartSection.minHeight || 3 },
          meta: {
            reason: `Filtered chart for non-sparse categorical field "${field.name}" (${field.uniqueValues} values, nullRate=${field.nullRate ?? 'unknown'})`,
            source: 'workflow',
            fieldShape: field.shape,
            fieldName: field.name,
            skeletonSlot: 'filtered-charts',
          },
        });
      });

      row += chartSection.minHeight || 3;
    } else if (chartRecs.length > 0) {
      // Fallback: use chart recommendations if no categorical fields
      const fallbackRecs = chartRecs.slice(0, maxCharts);
      const chartWidth = Math.floor(12 / fallbackRecs.length);

      fallbackRecs.forEach((rec, idx) => {
        blueprints.push({
          id: `filtered-chart-${idx}`,
          type: 'FilteredChart',
          propsBuilder: (m) => ({
            title: rec.bestFor || `${humanizeFieldName(rec.fieldName || 'status')} Chart`,
            categoryField: rec.fieldName
              ? (m[rec.fieldName] || rec.fieldName)
              : pickField(m, ['status', 'type', 'workflow_name'], 'status'),
            valueField: 'count',
            aggregation: 'count',
            innerChartType: 'BarChart',
            filterNulls: true,
          }),
          layout: { col: idx * chartWidth, row, w: chartWidth, h: chartSection.minHeight || 3 },
          meta: {
            reason: `Filtered chart from chart recommendation: ${rec.bestFor}`,
            source: 'workflow',
            fieldName: rec.fieldName,
            skeletonSlot: 'filtered-charts',
          },
        });
      });

      row += chartSection.minHeight || 3;
    } else {
      console.log(
        '[hybridBuilder] No non-sparse categorical fields or chart recs — skipping filtered-charts section',
      );
    }
  }

  console.log(
    `[hybridBuilder] Built ${blueprints.length} component blueprints for record-browser skeleton`,
  );

  return blueprints;
}
