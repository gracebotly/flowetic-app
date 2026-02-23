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

function buildVoiceAgentComponents(mappings: Record<string, string>): ComponentBlueprint[] {
  return [
    {
      id: 'total-calls', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Calls', valueField: pickField(m, ['call_id', 'id', 'call'], 'id'), aggregation: 'count', icon: 'phone' }),
      layout: { col: 0, row: 0, w: 3, h: 2 },
    },
    {
      id: 'avg-duration', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Avg Duration', valueField: pickField(m, ['duration', 'call_duration', 'length'], 'duration'), aggregation: 'avg', unit: 'seconds', icon: 'clock' }),
      layout: { col: 3, row: 0, w: 3, h: 2 },
    },
    {
      id: 'success-rate', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Success Rate', valueField: pickField(m, ['status', 'outcome', 'result'], 'status'), aggregation: 'percentage', condition: { equals: 'success' }, icon: 'check-circle' }),
      layout: { col: 6, row: 0, w: 3, h: 2 },
    },
    {
      id: 'total-cost', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Cost', valueField: pickField(m, ['cost', 'price', 'amount'], 'cost'), aggregation: 'sum', unit: 'USD', icon: 'dollar-sign' }),
      layout: { col: 9, row: 0, w: 3, h: 2 },
    },
    {
      id: 'calls-timeline', type: 'TimeseriesChart',
      propsBuilder: (m) => ({ title: 'Calls Over Time', xField: 'timestamp', yField: pickField(m, ['call_id', 'id'], 'id'), aggregation: 'count', interval: 'hour' }),
      layout: { col: 0, row: 2, w: 8, h: 4 },
    },
    {
      id: 'status-breakdown', type: 'PieChart',
      propsBuilder: (m) => ({ title: 'Call Status', field: pickField(m, ['status', 'outcome'], 'status') }),
      layout: { col: 8, row: 2, w: 4, h: 4 },
    },
    {
      id: 'recent-calls', type: 'DataTable',
      propsBuilder: (m) => ({
        title: 'Recent Calls',
        columns: [
          { key: pickField(m, ['call_id', 'id'], 'id'), label: 'Call ID' },
          { key: pickField(m, ['duration', 'call_duration'], 'duration'), label: 'Duration' },
          { key: pickField(m, ['status', 'outcome'], 'status'), label: 'Status' },
          { key: 'timestamp', label: 'Time' },
        ],
        pageSize: 10,
      }),
      layout: { col: 0, row: 6, w: 12, h: 4 },
    },
  ];
}

function buildWorkflowDashboardComponents(mappings: Record<string, string>): ComponentBlueprint[] {
  return [
    {
      id: 'total-executions', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Executions', valueField: pickField(m, ['execution_id', 'run_id', 'id'], 'id'), aggregation: 'count', icon: 'activity' }),
      layout: { col: 0, row: 0, w: 3, h: 2 },
    },
    {
      id: 'success-rate', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Success Rate', valueField: pickField(m, ['status', 'result', 'outcome'], 'status'), aggregation: 'percentage', condition: { equals: 'success' }, icon: 'check-circle' }),
      layout: { col: 3, row: 0, w: 3, h: 2 },
    },
    {
      id: 'avg-duration', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Avg Duration', valueField: pickField(m, ['duration', 'execution_time', 'elapsed'], 'duration'), aggregation: 'avg', unit: 'seconds', icon: 'clock' }),
      layout: { col: 6, row: 0, w: 3, h: 2 },
    },
    {
      id: 'total-processed', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Items Processed', valueField: pickField(m, ['items_count', 'records', 'processed'], 'id'), aggregation: 'sum', icon: 'layers' }),
      layout: { col: 9, row: 0, w: 3, h: 2 },
    },
    {
      id: 'executions-timeline', type: 'TimeseriesChart',
      propsBuilder: (m) => ({ title: 'Executions Over Time', xField: 'timestamp', yField: pickField(m, ['execution_id', 'run_id', 'id'], 'id'), aggregation: 'count', interval: 'hour' }),
      layout: { col: 0, row: 2, w: 8, h: 4 },
    },
    {
      id: 'status-breakdown', type: 'BarChart',
      propsBuilder: (m) => ({ title: 'Status Breakdown', field: pickField(m, ['status', 'result'], 'status'), aggregation: 'count' }),
      layout: { col: 8, row: 2, w: 4, h: 4 },
    },
    {
      id: 'recent-executions', type: 'DataTable',
      propsBuilder: (m) => ({
        title: 'Recent Executions',
        columns: [
          { key: pickField(m, ['execution_id', 'run_id', 'id'], 'id'), label: 'Run ID' },
          { key: pickField(m, ['workflow_name', 'name'], 'name'), label: 'Workflow' },
          { key: pickField(m, ['status', 'result'], 'status'), label: 'Status' },
          { key: pickField(m, ['duration', 'execution_time'], 'duration'), label: 'Duration' },
          { key: 'timestamp', label: 'Time' },
        ],
        pageSize: 10,
      }),
      layout: { col: 0, row: 6, w: 12, h: 4 },
    },
  ];
}

function buildMultiAgentComponents(mappings: Record<string, string>): ComponentBlueprint[] {
  return [
    {
      id: 'total-tasks', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Tasks', valueField: pickField(m, ['task_id', 'id'], 'id'), aggregation: 'count', icon: 'list-checks' }),
      layout: { col: 0, row: 0, w: 3, h: 2 },
    },
    {
      id: 'agents-active', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Active Agents', valueField: pickField(m, ['agent_id', 'agent', 'agent_name'], 'agent_id'), aggregation: 'count_distinct', icon: 'users' }),
      layout: { col: 3, row: 0, w: 3, h: 2 },
    },
    {
      id: 'completion-rate', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Completion Rate', valueField: pickField(m, ['status', 'result'], 'status'), aggregation: 'percentage', condition: { equals: 'completed' }, icon: 'check-circle' }),
      layout: { col: 6, row: 0, w: 3, h: 2 },
    },
    {
      id: 'avg-task-time', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Avg Task Time', valueField: pickField(m, ['duration', 'elapsed'], 'duration'), aggregation: 'avg', unit: 'seconds', icon: 'clock' }),
      layout: { col: 9, row: 0, w: 3, h: 2 },
    },
    {
      id: 'tasks-timeline', type: 'TimeseriesChart',
      propsBuilder: (m) => ({ title: 'Tasks Over Time', xField: 'timestamp', yField: pickField(m, ['task_id', 'id'], 'id'), aggregation: 'count', interval: 'hour' }),
      layout: { col: 0, row: 2, w: 8, h: 4 },
    },
    {
      id: 'agent-distribution', type: 'PieChart',
      propsBuilder: (m) => ({ title: 'Tasks by Agent', field: pickField(m, ['agent_id', 'agent_name', 'agent'], 'agent_id') }),
      layout: { col: 8, row: 2, w: 4, h: 4 },
    },
    {
      id: 'recent-tasks', type: 'DataTable',
      propsBuilder: (m) => ({
        title: 'Recent Tasks',
        columns: [
          { key: pickField(m, ['task_id', 'id'], 'id'), label: 'Task' },
          { key: pickField(m, ['agent_name', 'agent'], 'agent'), label: 'Agent' },
          { key: pickField(m, ['status', 'result'], 'status'), label: 'Status' },
          { key: 'timestamp', label: 'Time' },
        ],
        pageSize: 10,
      }),
      layout: { col: 0, row: 6, w: 12, h: 4 },
    },
  ];
}

function buildChatDashboardComponents(mappings: Record<string, string>): ComponentBlueprint[] {
  return [
    {
      id: 'total-conversations', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Conversations', valueField: pickField(m, ['conversation_id', 'session_id', 'id'], 'id'), aggregation: 'count', icon: 'message-circle' }),
      layout: { col: 0, row: 0, w: 3, h: 2 },
    },
    {
      id: 'total-messages', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Messages', valueField: pickField(m, ['message_id', 'id'], 'id'), aggregation: 'count', icon: 'messages-square' }),
      layout: { col: 3, row: 0, w: 3, h: 2 },
    },
    {
      id: 'avg-messages-per-session', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Avg Msgs/Session', valueField: pickField(m, ['message_id', 'id'], 'id'), aggregation: 'avg_per_group', groupBy: pickField(m, ['conversation_id', 'session_id'], 'session_id'), icon: 'bar-chart-2' }),
      layout: { col: 6, row: 0, w: 3, h: 2 },
    },
    {
      id: 'satisfaction', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Satisfaction', valueField: pickField(m, ['rating', 'satisfaction', 'score'], 'rating'), aggregation: 'avg', icon: 'star' }),
      layout: { col: 9, row: 0, w: 3, h: 2 },
    },
    {
      id: 'messages-timeline', type: 'TimeseriesChart',
      propsBuilder: (m) => ({ title: 'Messages Over Time', xField: 'timestamp', yField: pickField(m, ['message_id', 'id'], 'id'), aggregation: 'count', interval: 'hour' }),
      layout: { col: 0, row: 2, w: 8, h: 4 },
    },
    {
      id: 'intent-breakdown', type: 'PieChart',
      propsBuilder: (m) => ({ title: 'Intent Distribution', field: pickField(m, ['intent', 'category', 'topic'], 'intent') }),
      layout: { col: 8, row: 2, w: 4, h: 4 },
    },
    {
      id: 'recent-conversations', type: 'DataTable',
      propsBuilder: (m) => ({
        title: 'Recent Conversations',
        columns: [
          { key: pickField(m, ['conversation_id', 'session_id', 'id'], 'id'), label: 'Session' },
          { key: pickField(m, ['user_message', 'message'], 'message'), label: 'Last Message' },
          { key: pickField(m, ['status', 'state'], 'status'), label: 'Status' },
          { key: 'timestamp', label: 'Time' },
        ],
        pageSize: 10,
      }),
      layout: { col: 0, row: 6, w: 12, h: 4 },
    },
  ];
}

/**
 * Default/fallback template — uses available mappings to build a sensible dashboard
 * even when we don't know the exact platform type. This replaces the old 1-MetricCard else block.
 */
function buildDefaultComponents(mappings: Record<string, string>): ComponentBlueprint[] {
  const allFields = Object.values(mappings);
  return [
    {
      id: 'total-events', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Total Events', valueField: pickField(m, ['id', 'event_id'], 'id'), aggregation: 'count', icon: 'activity' }),
      layout: { col: 0, row: 0, w: 3, h: 2 },
    },
    {
      id: 'unique-types', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Event Types', valueField: pickField(m, ['type', 'event_type', 'category'], 'type'), aggregation: 'count_distinct', icon: 'tag' }),
      layout: { col: 3, row: 0, w: 3, h: 2 },
    },
    {
      id: 'success-rate', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Success Rate', valueField: pickField(m, ['status', 'result', 'outcome'], 'status'), aggregation: 'percentage', condition: { equals: 'success' }, icon: 'check-circle' }),
      layout: { col: 6, row: 0, w: 3, h: 2 },
    },
    {
      id: 'latest-activity', type: 'MetricCard',
      propsBuilder: (m) => ({ title: 'Latest Activity', valueField: 'timestamp', aggregation: 'latest', icon: 'clock' }),
      layout: { col: 9, row: 0, w: 3, h: 2 },
    },
    {
      id: 'events-timeline', type: 'TimeseriesChart',
      propsBuilder: (m) => ({ title: 'Events Over Time', xField: 'timestamp', yField: pickField(m, ['id', 'event_id'], 'id'), aggregation: 'count', interval: 'hour' }),
      layout: { col: 0, row: 2, w: 8, h: 4 },
    },
    {
      id: 'type-breakdown', type: 'BarChart',
      propsBuilder: (m) => ({ title: 'Event Types', field: pickField(m, ['type', 'event_type', 'category', 'status'], 'type'), aggregation: 'count' }),
      layout: { col: 8, row: 2, w: 4, h: 4 },
    },
    {
      id: 'recent-events', type: 'DataTable',
      propsBuilder: (m) => ({
        title: 'Recent Events',
        columns: allFields.length > 0
          ? allFields.slice(0, 5).map(f => ({ key: f, label: f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))
          : [
              { key: 'id', label: 'ID' },
              { key: 'type', label: 'Type' },
              { key: 'status', label: 'Status' },
              { key: 'timestamp', label: 'Time' },
            ],
        pageSize: 10,
      }),
      layout: { col: 0, row: 6, w: 12, h: 4 },
    },
  ];
}

// ============================================================================
// Design-token-driven component builder
// Replaces hardcoded templates when design_tokens.charts is available.
// Each dashboard is unique because the designSystemWorkflow recommends different
// charts based on the user's workflow type, entity, and style preferences.
// ============================================================================
function buildDesignTokenDrivenComponents(
  mappings: Record<string, string>,
  chartRecs: Array<{ type: string; bestFor: string }>,
  entityName: string,
): ComponentBlueprint[] {
  const components: ComponentBlueprint[] = [];
  const allFields = Object.values(mappings);
  let row = 0;

  // Map chart recommendation types to component types
  const chartTypeMap: Record<string, string> = {
    'funnel chart': 'BarChart',
    'roi metric card': 'MetricCard',
    'stacked bar chart': 'BarChart',
    'kpi cards': 'MetricCard',
    'data tables': 'DataTable',
    'line chart': 'TimeseriesChart',
    'timeseries chart': 'TimeseriesChart',
    'bar chart': 'BarChart',
    'pie chart': 'PieChart',
    'donut chart': 'DonutChart',
    'area chart': 'TimeseriesChart',
    'scatter chart': 'TimeseriesChart',
    'heatmap': 'BarChart',
    'gauge': 'MetricCard',
    'metric card': 'MetricCard',
    'table': 'DataTable',
  };

  // Sanitize entity name for titles
  const cleanEntity = entityName
    .replace(/^n8n:/, '')
    .replace(/:execution$/, '')
    .replace(/^Template \d+:\s*/, '')
    .trim();

  // ALWAYS start with 3 KPI metric cards (essential for any dashboard)
  components.push({
    id: 'primary-metric',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `Total ${cleanEntity} Runs`,
      valueField: pickField(m, ['execution_id', 'run_id', 'id'], 'id'),
      aggregation: 'count',
      icon: 'activity',
    }),
    layout: { col: 0, row, w: 4, h: 2 },
  });

  components.push({
    id: 'success-metric',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `${cleanEntity} Success Rate`,
      valueField: pickField(m, ['status', 'result', 'outcome'], 'status'),
      aggregation: 'percentage',
      condition: { equals: 'success' },
      icon: 'check-circle',
    }),
    layout: { col: 4, row, w: 4, h: 2 },
  });

  components.push({
    id: 'duration-metric',
    type: 'MetricCard',
    propsBuilder: (m) => ({
      title: `Avg ${cleanEntity} Duration`,
      valueField: pickField(m, ['duration', 'duration_ms', 'execution_time', 'elapsed'], 'duration_ms'),
      aggregation: 'avg',
      unit: 'ms',
      icon: 'clock',
    }),
    layout: { col: 8, row, w: 4, h: 2 },
  });
  row += 2;

  // Now add components from chart recommendations
  for (let i = 0; i < chartRecs.length; i++) {
    const rec = chartRecs[i];
    const normalizedType = rec.type.toLowerCase();
    const componentType = chartTypeMap[normalizedType] || 'BarChart';

    // Skip if we already have enough MetricCards from the base set
    if (componentType === 'MetricCard' && components.filter(c => c.type === 'MetricCard').length >= 4) {
      continue;
    }

    const chartId = `chart-${i}-${componentType.toLowerCase()}`;

    // Determine layout based on component type
    const isWide = componentType === 'DataTable' || componentType === 'TimeseriesChart';
    const width = isWide ? 12 : (i === 0 ? 8 : 4);
    const col = isWide ? 0 : (i === 0 ? 0 : 8);

    components.push({
      id: chartId,
      type: componentType,
      propsBuilder: (m) => {
        switch (componentType) {
          case 'TimeseriesChart':
            return {
              title: `${cleanEntity} ${rec.bestFor.length < 50 ? rec.bestFor : 'Over Time'}`,
              xField: 'timestamp',
              yField: pickField(m, ['id', 'execution_id', 'run_id'], 'id'),
              aggregation: 'count',
              interval: 'hour',
            };
          case 'BarChart':
            return {
              title: rec.bestFor.length < 60 ? rec.bestFor : `${cleanEntity} Breakdown`,
              field: pickField(m, ['status', 'type', 'name', 'category'], 'status'),
              aggregation: 'count',
            };
          case 'PieChart':
          case 'DonutChart':
            return {
              title: `${cleanEntity} Distribution`,
              field: pickField(m, ['status', 'type', 'category', 'name'], 'status'),
            };
          case 'DataTable':
            return {
              title: `Recent ${cleanEntity} Activity`,
              columns: allFields.length > 0
                ? allFields.slice(0, 5).map(f => ({
                    key: f,
                    label: f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                  }))
                : [
                    { key: 'id', label: 'ID' },
                    { key: 'status', label: 'Status' },
                    { key: 'timestamp', label: 'Time' },
                  ],
              pageSize: 10,
            };
          case 'MetricCard':
            return {
              title: rec.bestFor.length < 40 ? rec.bestFor : `${cleanEntity} Metric`,
              valueField: pickField(m, ['value', 'cost', 'amount', 'id'], 'id'),
              aggregation: 'count',
              icon: 'bar-chart-2',
            };
          default:
            return {
              title: rec.bestFor || `${cleanEntity} Chart`,
              field: pickField(m, ['status', 'type'], 'status'),
            };
        }
      },
      layout: { col, row, w: width, h: 4 },
    });

    // Advance row if wide component or after two side-by-side
    if (isWide || (i > 0 && i % 2 === 0)) {
      row += 4;
    }
  }

  // Always end with a data table if none exists from recommendations
  const hasTable = components.some(c => c.type === 'DataTable');
  if (!hasTable) {
    components.push({
      id: 'recent-activity-table',
      type: 'DataTable',
      propsBuilder: (m) => ({
        title: `Recent ${cleanEntity} Activity`,
        columns: allFields.length > 0
          ? allFields.slice(0, 5).map(f => ({
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
      layout: { col: 0, row: row + 4, w: 12, h: 4 },
    });
  }

  console.log(`[buildDesignTokenDrivenComponents] Built ${components.length} components from ${chartRecs.length} chart recs for entity "${cleanEntity}"`);
  return components;
}

// ============================================================================
// Template ID → Blueprint resolver
// ============================================================================
function getTemplateBlueprints(
  templateId: string,
  mappings: Record<string, string>,
  chartRecommendations?: Array<{ type: string; bestFor: string }>,
  entityName?: string,
): ComponentBlueprint[] {
  // If we have chart recommendations from the design system, build a CUSTOM layout
  if (chartRecommendations && chartRecommendations.length > 0 && entityName) {
    return buildDesignTokenDrivenComponents(mappings, chartRecommendations, entityName);
  }
  // Fallback to hardcoded templates ONLY if no chart recommendations exist
  switch (templateId) {
    case 'voice-agent-dashboard':
      return buildVoiceAgentComponents(mappings);
    case 'workflow-dashboard':
      return buildWorkflowDashboardComponents(mappings);
    case 'multi-agent-dashboard':
      return buildMultiAgentComponents(mappings);
    case 'chat-dashboard':
      return buildChatDashboardComponents(mappings);
    default:
      return buildDefaultComponents(mappings);
  }
}

export function resolveStyleBundleId(input: string): string {
  console.warn(`[resolveStyleBundleId] DEPRECATED: "${input}" — presets removed. Use custom design tokens.`);
  return 'custom';
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
    })).optional().describe('Chart recommendations from design_tokens.charts — drives custom component layout instead of hardcoded templates'),
    entityName: z.string().optional().describe('Primary entity name for personalized dashboard titles'),
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

    // Extract chart recommendations from design tokens (RequestContext) or input
    let chartRecs = inputData.chartRecommendations;
    let entityName = inputData.entityName;

    if (!chartRecs && customTokensJson) {
      try {
        const parsed = JSON.parse(customTokensJson);
        chartRecs = parsed.charts;
      } catch { /* ignore — already parsed above */ }
    }

    // Try to get entity name from RequestContext if not provided
    if (!entityName) {
      const selectedEntities = context?.requestContext?.get('selectedEntities') as string;
      if (selectedEntities) {
        // selectedEntities can be comma-separated names like "Leads, ROI Metrics"
        // or a JSON array of objects. Try both formats.
        try {
          const parsed = JSON.parse(selectedEntities);
          entityName = Array.isArray(parsed)
            ? (parsed[0]?.display_name || parsed[0]?.name)
            : undefined;
        } catch {
          // It's a plain string (comma-separated names) — use first entity
          entityName = selectedEntities.split(',')[0]?.trim();
        }
      }
    }

    // Build deterministic component array from template blueprints
    // If chart recommendations exist, builds a CUSTOM layout instead of hardcoded templates
    const blueprints = getTemplateBlueprints(templateId, mappings, chartRecs, entityName);
    const fieldNames = Object.keys(mappings);

    const components = blueprints.map(bp => ({
      id: bp.id,
      type: bp.type,
      props: bp.propsBuilder(mappings, fieldNames),
      layout: bp.layout,
    }));

    // Build metadata from design tokens for the preview page
    const parsedForMeta = customTokensJson ? JSON.parse(customTokensJson) : {};

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
        title: entityName
          ? `${entityName} Dashboard`
          : `${platformType.charAt(0).toUpperCase() + platformType.slice(1)} Dashboard`,
        designTokens: {
          colors: styleTokens.colors,
          fonts: styleTokens.fonts,
        },
        styleName: parsedForMeta.style?.name || parsedForMeta.styleName || undefined,
        generatedAt: new Date().toISOString(),
        chartRecommendations: chartRecs || undefined,
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
