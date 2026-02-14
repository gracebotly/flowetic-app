import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ============================================================================
// Style bundle catalog
// Used to resolve selectedStyleBundleId → design tokens
// Design selection now handled by designSystemWorkflow + ui-ux-pro-max skill
// ============================================================================
const STYLE_BUNDLE_TOKENS: Record<string, {
  colors: { primary: string; secondary: string; success: string; warning: string; error: string; background: string; text: string };
  fonts: { heading: string; body: string };
  spacing: { unit: number };
  radius: number;
  shadow: string;
}> = {
  'professional-clean': {
    colors: { primary: '#2563EB', secondary: '#64748B', success: '#10B981', warning: '#F59E0B', error: '#EF4444', background: '#F8FAFC', text: '#0F172A' },
    fonts: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
    spacing: { unit: 10 },
    radius: 8,
    shadow: 'soft',
  },
  'premium-dark': {
    colors: { primary: '#60A5FA', secondary: '#A78BFA', success: '#34D399', warning: '#FBBF24', error: '#F87171', background: '#0B1220', text: '#E5E7EB' },
    fonts: { heading: 'Plus Jakarta Sans, sans-serif', body: 'Inter, sans-serif' },
    spacing: { unit: 10 },
    radius: 8,
    shadow: 'glow',
  },
  'glass-premium': {
    colors: { primary: '#818CF8', secondary: '#C084FC', success: '#6EE7B7', warning: '#FCD34D', error: '#FCA5A5', background: '#0F172A', text: '#F1F5F9' },
    fonts: { heading: 'Outfit, sans-serif', body: 'DM Sans, sans-serif' },
    spacing: { unit: 10 },
    radius: 12,
    shadow: 'glass',
  },
  'bold-startup': {
    colors: { primary: '#F97316', secondary: '#06B6D4', success: '#22C55E', warning: '#EAB308', error: '#DC2626', background: '#FFFFFF', text: '#18181B' },
    fonts: { heading: 'Space Grotesk, sans-serif', body: 'DM Sans, sans-serif' },
    spacing: { unit: 8 },
    radius: 12,
    shadow: 'medium',
  },
  'corporate-trust': {
    colors: { primary: '#1E40AF', secondary: '#475569', success: '#059669', warning: '#D97706', error: '#DC2626', background: '#F1F5F9', text: '#1E293B' },
    fonts: { heading: 'Instrument Sans, sans-serif', body: 'Source Sans 3, sans-serif' },
    spacing: { unit: 10 },
    radius: 6,
    shadow: 'subtle',
  },
  'neon-cyber': {
    colors: { primary: '#22D3EE', secondary: '#A855F7', success: '#4ADE80', warning: '#FACC15', error: '#FB7185', background: '#030712', text: '#F9FAFB' },
    fonts: { heading: 'JetBrains Mono, monospace', body: 'Inter, sans-serif' },
    spacing: { unit: 8 },
    radius: 4,
    shadow: 'neon',
  },
  'pastel-soft': {
    colors: { primary: '#93C5FD', secondary: '#C4B5FD', success: '#86EFAC', warning: '#FDE68A', error: '#FCA5A5', background: '#FFFBEB', text: '#1F2937' },
    fonts: { heading: 'Nunito, sans-serif', body: 'Quicksand, sans-serif' },
    spacing: { unit: 12 },
    radius: 16,
    shadow: 'soft',
  },
  'warm-earth': {
    colors: { primary: '#D97706', secondary: '#92400E', success: '#65A30D', warning: '#CA8A04', error: '#DC2626', background: '#FFFBF0', text: '#292524' },
    fonts: { heading: 'Libre Baskerville, serif', body: 'Lato, sans-serif' },
    spacing: { unit: 10 },
    radius: 8,
    shadow: 'warm',
  },
};

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

// ============================================================================
// Style bundle ID resolver — handles LLM-generated display names
// that don't match the hardcoded STYLE_BUNDLE_TOKENS keys.
// Uses keyword matching to find the closest bundle.
// ============================================================================
function resolveStyleBundleId(input: string): string {
  // Direct match — fast path
  if (STYLE_BUNDLE_TOKENS[input]) return input;

  const KEYWORD_MAP: Record<string, string[]> = {
    'professional-clean': ['professional', 'clean', 'minimal', 'simple', 'executive', 'business'],
    'premium-dark': ['premium', 'dark', 'elegant', 'luxury', 'sophisticated', 'night', 'sleek'],
    'glass-premium': ['glass', 'glassmorphism', 'frosted', 'translucent', 'blur', 'transparent', 'aurora'],
    'bold-startup': ['bold', 'startup', 'energetic', 'vibrant', 'playful', 'bright', 'fun'],
    'corporate-trust': ['corporate', 'trust', 'formal', 'authority', 'banking', 'finance', 'enterprise'],
    'neon-cyber': ['neon', 'cyber', 'monitoring', 'modern', 'electric', 'real-time', 'tech', 'hud', 'dashboard', 'analytics', 'terminal', 'matrix'],
    'pastel-soft': ['pastel', 'soft', 'gentle', 'calming', 'wellness', 'health', 'light', 'friendly'],
    'warm-earth': ['warm', 'earth', 'organic', 'natural', 'rustic', 'cozy', 'brown', 'sustainable'],
  };

  const inputLower = input.toLowerCase().replace(/[-_]/g, ' ');
  let bestMatch = 'professional-clean';
  let bestScore = 0;

  for (const [bundleId, keywords] of Object.entries(KEYWORD_MAP)) {
    const score = keywords.filter(kw => inputLower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = bundleId;
    }
  }

  console.log(`[generateUISpec] Resolved style "${input}" → "${bestMatch}" (score: ${bestScore})`);
  return bestMatch;
}

// ============================================================================
// The tool itself
// ============================================================================
export const generateUISpec = createTool({
  id: 'generate-ui-spec',
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

    // Resolve style bundle: input param → RequestContext → fallback
    const rawStyleBundleId =
      inputData.selectedStyleBundleId ||
      (context?.requestContext?.get('selectedStyleBundleId') as string) ||
      'professional-clean';

    // Resolve display names (e.g. "Modern Monitoring") to valid token keys (e.g. "neon-cyber")
    const styleBundleId = resolveStyleBundleId(rawStyleBundleId);
    const styleTokens = STYLE_BUNDLE_TOKENS[styleBundleId];

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
