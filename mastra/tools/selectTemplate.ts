import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { classifyArchetype } from '../lib/classifyArchetype';

// ============================================================================
// Field-name signal patterns
// These detect domain-specific data shapes regardless of workflow name.
// Each pattern has keywords to match against field names and a weight.
// ============================================================================

interface FieldSignalPattern {
  /** Domain this pattern detects */
  domain: string;
  /** Maps to this templateId */
  templateId: string;
  /** Maps to this archetype (matches classifyArchetype output) */
  archetype: string;
  /** Keywords to match against field names (case-insensitive) */
  fieldKeywords: string[];
  /** Minimum number of keyword matches to trigger */
  threshold: number;
}

const FIELD_SIGNAL_PATTERNS: FieldSignalPattern[] = [
  {
    domain: 'lead-pipeline',
    templateId: 'lead-pipeline-dashboard',
    archetype: 'lead_pipeline',
    fieldKeywords: [
      'lead', 'lead_id', 'qualified', 'score', 'company', 'budget',
      'source', 'funnel', 'conversion', 'deal', 'opportunity', 'prospect',
      'pipeline', 'revenue', 'roi', 'industry', 'decision_maker',
    ],
    threshold: 3, // Need 3+ lead-like fields to be confident
  },
  {
    domain: 'voice-analytics',
    templateId: 'voice-agent-dashboard',
    archetype: 'voice_analytics',
    fieldKeywords: [
      'call_id', 'caller', 'callee', 'duration', 'transcript', 'sentiment',
      'call_status', 'recording', 'agent_name', 'call_type', 'hold_time',
      'ring_time', 'disposition', 'talk_time',
    ],
    threshold: 2,
  },
  {
    domain: 'chatbot',
    templateId: 'chatbot-dashboard',
    archetype: 'ai_automation',
    fieldKeywords: [
      'message', 'response', 'conversation_id', 'session_id', 'user_message',
      'bot_response', 'intent', 'confidence', 'sentiment', 'response_time',
      'channel', 'escalated', 'resolved', 'satisfaction',
    ],
    threshold: 2,
  },
  {
    domain: 'ai-research',
    templateId: 'ai-research-dashboard',
    archetype: 'ai_automation',
    fieldKeywords: [
      'topic', 'research', 'sources', 'context', 'depth', 'analysis',
      'embedding', 'vector', 'prompt', 'completion', 'tokens', 'model',
      'inference', 'output_format', 'source_count',
    ],
    threshold: 2,
  },
  {
    domain: 'content-automation',
    templateId: 'content-dashboard',
    archetype: 'content_automation',
    fieldKeywords: [
      'post', 'publish', 'article', 'blog', 'content', 'engagement',
      'views', 'likes', 'shares', 'comments', 'platform', 'schedule',
      'campaign', 'newsletter', 'click_rate', 'open_rate',
    ],
    threshold: 2,
  },
  {
    domain: 'data-integration',
    templateId: 'data-integration-dashboard',
    archetype: 'data_integration',
    fieldKeywords: [
      'sync', 'import', 'export', 'records_processed', 'rows',
      'source_table', 'destination', 'batch_id', 'transform',
      'schema', 'migration', 'etl', 'warehouse',
    ],
    threshold: 2,
  },
  {
    domain: 'client-reporting',
    templateId: 'client-reporting-dashboard',
    archetype: 'client_reporting',
    fieldKeywords: [
      'client_name', 'client_id', 'account', 'agency', 'report',
      'by_platform', 'raw_metrics', 'snapshot', 'period',
      'campaign_name', 'ad_spend', 'impressions', 'clicks',
    ],
    threshold: 2,
  },
];

/**
 * Score field names against a signal pattern.
 * Returns the number of keyword matches found in the field names.
 */
function scoreFieldSignals(
  fieldNames: string[],
  pattern: FieldSignalPattern,
): { matches: number; matchedKeywords: string[] } {
  const lowerFields = fieldNames.map(f => f.toLowerCase());
  const matchedKeywords: string[] = [];

  for (const keyword of pattern.fieldKeywords) {
    const keywordLower = keyword.toLowerCase();
    // Check for exact match or partial match (field contains keyword or keyword contains field)
    const found = lowerFields.some(f =>
      f === keywordLower ||
      f.includes(keywordLower) ||
      keywordLower.includes(f)
    );
    if (found) {
      matchedKeywords.push(keyword);
    }
  }

  return { matches: matchedKeywords.length, matchedKeywords };
}

export const selectTemplate = createTool({
  id: 'selectTemplate',
  description: 'Selects the best dashboard template based on platform type, schema fields, and workflow archetype classification',
  inputSchema: z.object({
    platformType: z.enum(['vapi', 'retell', 'n8n', 'mastra', 'crewai', 'make']),
    eventTypes: z.array(z.string()),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
    // Optional: workflow name for archetype classification
    workflowName: z.string().optional(),
    // Optional: entity names for archetype classification
    entityNames: z.string().optional(),
  }),
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    archetype: z.string(),
  }),
  execute: async (inputData, context) => {
    const { platformType, eventTypes, fields, workflowName, entityNames } = inputData;
    const fieldNames = fields.map(f => f.name);

    console.log(`[selectTemplate] Input: platform="${platformType}", fields=${fieldNames.length}, workflowName="${workflowName || 'none'}", entityNames="${entityNames || 'none'}"`);
    console.log(`[selectTemplate] Field names: [${fieldNames.slice(0, 15).join(', ')}${fieldNames.length > 15 ? '...' : ''}]`);

    // ── Priority 1: Voice platforms (platform IS the signal) ──────────
    if (platformType === 'vapi' || platformType === 'retell') {
      console.log(`[selectTemplate] Voice platform detected: ${platformType}`);
      return {
        templateId: 'voice-agent-dashboard',
        confidence: 0.95,
        reason: `Voice agent platform (${platformType}) detected — voice analytics dashboard`,
        archetype: 'voice_analytics',
      };
    }

    // ── Priority 2: Field-name signal analysis ───────────────────────
    // Score ALL patterns against the actual field names from analyzeSchema.
    // The pattern with the highest score above its threshold wins.
    const fieldScores = FIELD_SIGNAL_PATTERNS.map(pattern => {
      const { matches, matchedKeywords } = scoreFieldSignals(fieldNames, pattern);
      return {
        ...pattern,
        matches,
        matchedKeywords,
        aboveThreshold: matches >= pattern.threshold,
      };
    });

    // Sort by match count descending
    fieldScores.sort((a, b) => b.matches - a.matches);

    const bestFieldMatch = fieldScores.find(s => s.aboveThreshold);

    if (bestFieldMatch) {
      // Field signals are strong — use them
      const confidence = Math.min(0.95, 0.7 + (bestFieldMatch.matches * 0.05));
      console.log(`[selectTemplate] Field signal match: domain="${bestFieldMatch.domain}", matched=[${bestFieldMatch.matchedKeywords.join(', ')}] (${bestFieldMatch.matches}/${bestFieldMatch.threshold} threshold)`);

      return {
        templateId: bestFieldMatch.templateId,
        confidence,
        reason: `Field analysis detected ${bestFieldMatch.domain} data (matched: ${bestFieldMatch.matchedKeywords.slice(0, 5).join(', ')})`,
        archetype: bestFieldMatch.archetype,
      };
    }

    // ── Priority 3: Workflow name archetype classification ───────────
    // Fall back to classifyArchetype which examines workflow name + platform + entities
    if (workflowName) {
      const classification = classifyArchetype(
        workflowName,
        platformType,
        entityNames || '',
      );

      if (classification.archetype !== 'general' && classification.confidence > 0.2) {
        // Map archetype → templateId
        const ARCHETYPE_TO_TEMPLATE: Record<string, string> = {
          ops_monitoring: 'ops-monitoring-dashboard',
          lead_pipeline: 'lead-pipeline-dashboard',
          voice_analytics: 'voice-agent-dashboard',
          content_automation: 'content-dashboard',
          data_integration: 'data-integration-dashboard',
          client_reporting: 'client-reporting-dashboard',
          ai_automation: 'ai-automation-dashboard',
        };

        const templateId = ARCHETYPE_TO_TEMPLATE[classification.archetype] || 'workflow-dashboard';
        console.log(`[selectTemplate] Archetype classification: "${classification.archetype}" (confidence=${classification.confidence.toFixed(2)}, signals=[${classification.matchedSignals.slice(0, 5).join(', ')}])`);

        return {
          templateId,
          confidence: Math.min(0.9, 0.6 + classification.confidence * 0.3),
          reason: `Workflow name classified as ${classification.archetype} (signals: ${classification.matchedSignals.slice(0, 3).join(', ')})`,
          archetype: classification.archetype,
        };
      }
    }

    // ── Priority 4: Event type fallback ──────────────────────────────
    const hasMessages = eventTypes.includes('message');
    const hasMetrics = eventTypes.includes('metric');
    const hasToolEvents = eventTypes.includes('tool_event');

    if (hasMessages && !hasMetrics) {
      console.log('[selectTemplate] Fallback: message-heavy data');
      return {
        templateId: 'chatbot-dashboard',
        confidence: 0.65,
        reason: 'Message-heavy event data detected',
        archetype: 'ai_automation',
      };
    }

    if (hasToolEvents) {
      console.log('[selectTemplate] Fallback: tool events');
      return {
        templateId: 'workflow-dashboard',
        confidence: 0.6,
        reason: 'Tool execution events detected',
        archetype: 'general',
      };
    }

    // ── Priority 5: Platform-type generic fallback ───────────────────
    // This is where the OLD code ALWAYS landed for n8n/mastra.
    // Now it's the last resort, not the first check.
    if (platformType === 'crewai') {
      console.log('[selectTemplate] Fallback: CrewAI platform');
      return {
        templateId: 'multi-agent-dashboard',
        confidence: 0.7,
        reason: 'Multi-agent orchestration platform (CrewAI)',
        archetype: 'ai_automation',
      };
    }

    console.log('[selectTemplate] Final fallback: generic workflow dashboard');
    return {
      templateId: 'workflow-dashboard',
      confidence: 0.5,
      reason: 'Generic workflow dashboard (no strong field or name signals detected)',
      archetype: 'general',
    };
  },
});
