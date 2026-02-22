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
// Template ID → Blueprint resolver
// ============================================================================
function getTemplateBlueprints(templateId: string, mappings: Record<string, string>): ComponentBlueprint[] {
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
      } catch {
        console.warn('[generateUISpec] Failed to parse custom tokens — using defaults');
        styleBundleId = 'custom';
        styleTokens = {
          colors: {
            primary: '#2563EB',
            secondary: '#64748B',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            background: '#F8FAFC',
            text: '#0F172A',
          },
          fonts: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
          spacing: { unit: 8 },
          radius: 8,
          shadow: 'soft',
        };
      }
    } else {
      // ── NO CUSTOM TOKENS: Use sensible defaults ──────────────────────────
      // Presets have been removed. If no custom tokens exist, the design system
      // workflow should have been triggered first. Use minimal defaults.
      console.warn('[generateUISpec] No custom design tokens found. Run designSystemWorkflow first.');
      styleBundleId = 'custom';
      styleTokens = {
        colors: {
          primary: '#2563EB',
          secondary: '#64748B',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          background: '#F8FAFC',
          text: '#0F172A',
        },
        fonts: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
        spacing: { unit: 8 },
        radius: 8,
        shadow: 'soft',
      };
    }

    // Build deterministic component array from template blueprints
    const blueprints = getTemplateBlueprints(templateId, mappings);
    const fieldNames = Object.keys(mappings);

    const components = blueprints.map(bp => ({
      id: bp.id,
      type: bp.type,
      props: bp.propsBuilder(mappings, fieldNames),
      layout: bp.layout,
    }));

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
    };

    // Design tokens resolved from the selected style bundle
    const design_tokens = {
      colors: styleTokens.colors,
      fonts: styleTokens.fonts,
      spacing: styleTokens.spacing,
      radius: styleTokens.radius,
      shadow: styleTokens.shadow,
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
