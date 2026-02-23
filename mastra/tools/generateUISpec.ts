import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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
  propsBuilder: (mappings: Record<string, string>, fields: string[]) => Record<string, any>;
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
function buildComponentsFromDesignTokens(
  mappings: Record<string, string>,
  chartRecs: Array<{ type: string; bestFor: string }>,
  entityName: string,
): ComponentBlueprint[] {
  const components: ComponentBlueprint[] = [];
  const allFields = Object.values(mappings);
  const entity = cleanEntityName(entityName);
  let row = 0;

  // ── ROW 0: Three KPI cards (always present, entity-named) ──────────────
  components.push({
    id: 'primary-kpi',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `Total ${pluralizeEntity(entity)}`,
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
      title: `${entity} Success Rate`,
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
      title: `Avg ${entity} Duration`,
      valueField: pickField(m, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'),
      aggregation: 'avg',
      unit: 'ms',
      icon: 'clock',
    }),
    layout: { col: 8, row, w: 4, h: 2 },
  });

  row += 2;

  // ── ROWS 2+: Components from chart recommendations ─────────────────────
  let metricCount = 3; // already placed 3 KPIs above

  for (let i = 0; i < chartRecs.length; i++) {
    const rec = chartRecs[i];
    const componentType = mapChartRecToComponentType(rec.type);

    // Cap MetricCards at 4 total
    if (componentType === 'MetricCard' && metricCount >= 4) continue;
    if (componentType === 'MetricCard') metricCount++;

    const chartId = `rec-${i}-${componentType.toLowerCase()}`;
    const isFullWidth = componentType === 'DataTable' || componentType === 'TimeseriesChart';
    const width = isFullWidth ? 12 : 8;
    const col = 0;

    components.push({
      id: chartId,
      type: componentType,
      propsBuilder: (m) => {
        // Only use bestFor as title if it's specific to this workflow (not a generic CSV data-type).
        // Generic labels like "Trend Over Time", "Compare Categories", "Part-to-Whole"
        // are CSV data-type descriptions, NOT good dashboard titles.
        const genericBestForPatterns = [
          'trend over time', 'compare categories', 'part-to-whole', 'general visualization',
          'general', 'comparisons', 'distribution', 'composition', 'relationship',
          'ranking', 'proportion', 'change over time', 'correlation',
        ];
        const isGenericBestFor = genericBestForPatterns.some(p => rec.bestFor.toLowerCase().includes(p));
        const shortBestFor = (!isGenericBestFor && rec.bestFor.length < 55) ? rec.bestFor : '';

        switch (componentType) {
          case 'TimeseriesChart':
            return {
              title: shortBestFor || `${pluralizeEntity(entity)} Over Time`,
              xField: 'timestamp',
              yField: pickField(m, ['id', 'execution_id', 'run_id'], 'id'),
              aggregation: 'count',
              interval: 'hour',
            };
          case 'BarChart':
            return {
              title: shortBestFor || `${pluralizeEntity(entity)} by Status`,
              field: pickField(m, ['status', 'type', 'name', 'category'], 'status'),
              aggregation: 'count',
            };
          case 'PieChart':
          case 'DonutChart':
            return {
              title: shortBestFor || `${pluralizeEntity(entity)} by Category`,
              field: pickField(m, ['status', 'type', 'category', 'name'], 'status'),
            };
          case 'DataTable':
            return {
              title: `Recent ${pluralizeEntity(entity)}`,
              columns: allFields.length > 0
                ? allFields.slice(0, 6).map(f => ({
                    key: f,
                    label: f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
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
              title: shortBestFor || `${entity} Count`,
              valueField: pickField(m, ['value', 'cost', 'amount', 'score', 'id'], 'id'),
              aggregation: 'count',
              icon: 'bar-chart-2',
            };
          default:
            return { title: shortBestFor || `${pluralizeEntity(entity)} Overview`, field: 'status' };
        }
      },
      layout: { col, row, w: width, h: 4 },
    });

    row += 4;
  }

  // ── FINAL ROW: Data table if none from recommendations ─────────────────
  if (!components.some(c => c.type === 'DataTable')) {
    components.push({
      id: 'activity-table',
      type: 'DataTable',
      propsBuilder: (m) => ({
        title: `Recent ${pluralizeEntity(entity)}`,
        columns: allFields.length > 0
          ? allFields.slice(0, 6).map(f => ({
              key: f,
              label: f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
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
    `[buildComponentsFromDesignTokens] Built ${components.length} UNIQUE components ` +
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
    })).optional(),
    entityName: z.string().optional(),
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
    const blueprints = buildComponentsFromDesignTokens(mappings, chartRecs, resolvedEntityName);
    const fieldNames = Object.keys(mappings);

    const components = blueprints.map(bp => ({
      id: bp.id,
      type: bp.type,
      props: bp.propsBuilder(mappings, fieldNames),
      layout: bp.layout,
    }));

    const parsedCustomForMeta = customTokensJson ? JSON.parse(customTokensJson) : {};
    const entity = cleanEntityName(resolvedEntityName);

    const spec_json = {
      version: '1.0',
      templateId,
      platformType,
      styleBundleId,
      layout: {
        type: 'grid',
        columns: 12,
        gap: styleTokens.spacing.unit / 2,
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
