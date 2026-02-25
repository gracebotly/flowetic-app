// mastra/lib/goalExplorer.ts
// ============================================================================
// LLM-powered Goal Explorer — LIDA-pattern data intelligence.
//
// Instead of matching workflow names against keyword lists, we send the actual
// data profile (event counts, field shapes, real statistics) to an LLM and ask:
// "Given THIS data, what dashboard proposals make sense?"
//
// This is the LIDA pattern (Microsoft Research, ACL 2023):
//   data summarization → goal exploration → visualization generation
//
// The LLM reasons about what the data can actually support rather than
// guessing from a name. classifyArchetype() remains as a fast fallback
// if the LLM call fails or times out.
//
// Called from: generateProposals.ts (replaces classifyArchetype as primary)
// ============================================================================

import { generateObject } from 'ai';
import { z } from 'zod';
import { getModelById } from './models/modelSelector';
import { classifyArchetype } from './classifyArchetype';
import type {
  Archetype,
  EmphasisBlend,
  GoalExplorerResult,
  ProposalGoal,
} from '@/types/proposal';

// ─── Data Availability type (same as in generateProposals.ts) ─────────────
// Re-declared here to avoid circular imports. The canonical definition
// lives in generateProposals.ts.

interface DataAvailability {
  totalEvents: number;
  eventTypes: string[];
  availableFields: string[];
  fieldShapes: Record<string, 'status' | 'timestamp' | 'duration' | 'identifier' | 'text' | 'numeric'>;
  dataRichness: 'rich' | 'moderate' | 'sparse' | 'minimal';
  canSupportTimeseries: boolean;
  canSupportBreakdowns: boolean;
  usableFieldCount: number;
}

// ─── Build natural language data summary (LIDA Summarizer step) ───────────

function buildDataSummary(
  workflowName: string,
  platformType: string,
  selectedEntities: string,
  data: DataAvailability,
): string {
  const lines: string[] = [];

  // Header
  lines.push(`Workflow: "${workflowName}" on ${platformType}`);
  lines.push(`Entities: ${selectedEntities || 'none specified'}`);
  lines.push('');

  // Event overview
  lines.push(`Total events: ${data.totalEvents}`);
  lines.push(`Event types: ${data.eventTypes.length > 0 ? data.eventTypes.join(', ') : 'none'}`);
  lines.push(`Data richness: ${data.dataRichness}`);
  lines.push('');

  // Field inventory grouped by shape
  const grouped: Record<string, string[]> = {};
  for (const field of data.availableFields) {
    const shape = data.fieldShapes[field] || 'text';
    if (!grouped[shape]) grouped[shape] = [];
    grouped[shape].push(field);
  }

  lines.push('Fields by type:');
  for (const [shape, fields] of Object.entries(grouped)) {
    if (shape === 'identifier') continue; // Skip IDs — not useful for visualization
    lines.push(`  ${shape}: ${fields.join(', ')}`);
  }
  lines.push('');

  // Capability flags
  lines.push('Capabilities:');
  lines.push(`  Time-series possible: ${data.canSupportTimeseries ? 'yes' : 'no'}`);
  lines.push(`  Categorical breakdowns possible: ${data.canSupportBreakdowns ? 'yes' : 'no'}`);
  lines.push(`  Usable (non-ID) fields: ${data.usableFieldCount}`);

  return lines.join('\n');
}

// ─── LLM Goal Explorer prompt ─────────────────────────────────────────────

function buildExplorerPrompt(dataSummary: string): string {
  return `You are a data visualization expert for an AI automation dashboard builder.

Given the data profile below, decide what dashboard proposals would be most valuable.
You must ONLY recommend what the data can actually support — never hallucinate metrics.

DATA PROFILE:
${dataSummary}

RULES:
1. If totalEvents < 10, recommend at most 1 simple overview proposal.
2. If totalEvents < 50 or data richness is "sparse", recommend at most 2 proposals.
3. If totalEvents >= 50 AND data richness is "moderate" or "rich", recommend up to 3.
4. Each proposal must use ONLY fields that exist in the data profile above.
5. The "emphasis" blend must sum to 1.0 (dashboard + product + analytics).
6. For chartTypes, only use: kpi, line_chart, bar_chart, pie_chart, table, funnel, timeline, status_grid.
7. Consider the workflow name for CONTEXT only — classify based on what the DATA shows, not the name.
8. Each proposal should serve a different PURPOSE (e.g., operational monitoring vs client-facing vs analytics).

For "category", choose the single best match from:
ops_monitoring, lead_pipeline, voice_analytics, content_automation, data_integration, client_reporting, ai_automation, general

Respond with ONLY valid JSON, no markdown fences, no commentary:
{
  "category": "ops_monitoring",
  "confidence": 0.85,
  "reasoning": "30 workflow_execution events with status, duration_ms, and error_message fields indicate this is operational monitoring data regardless of the workflow name.",
  "proposalCount": 2,
  "goals": [
    {
      "title": "Execution Health Monitor",
      "pitch": "Track success rates and catch failures early with real-time status and duration metrics.",
      "focusMetrics": ["status", "duration_ms", "error_message"],
      "chartTypes": ["kpi", "line_chart", "status_grid"],
      "emphasis": { "dashboard": 0.7, "product": 0.2, "analytics": 0.1 }
    }
  ]
}`;
}

// ─── Parse and validate LLM response ──────────────────────────────────────

const VALID_ARCHETYPES: Archetype[] = [
  'ops_monitoring', 'lead_pipeline', 'voice_analytics', 'content_automation',
  'data_integration', 'client_reporting', 'ai_automation', 'general',
];

// ─── Zod schema for structured LLM output ─────────────────────────────────
// Using generateObject() with a Zod schema prevents truncated JSON,
// enforces types at the provider level, and eliminates parse failures.

const GoalExplorerOutputSchema = z.object({
  category: z.enum([
    'ops_monitoring', 'lead_pipeline', 'voice_analytics', 'content_automation',
    'data_integration', 'client_reporting', 'ai_automation', 'general',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  proposalCount: z.number().int().min(1).max(3),
  goals: z.array(z.object({
    title: z.string(),
    pitch: z.string(),
    focusMetrics: z.array(z.string()),
    chartTypes: z.array(z.enum([
      'kpi', 'line_chart', 'bar_chart', 'pie_chart', 'table', 'funnel', 'timeline', 'status_grid',
    ])),
    emphasis: z.object({
      dashboard: z.number(),
      product: z.number(),
      analytics: z.number(),
    }),
  })).min(1).max(3),
});

// ─── Build fallback result from classifyArchetype ─────────────────────────

function buildFallbackResult(
  workflowName: string,
  platformType: string,
  selectedEntities: string,
  data: DataAvailability | null,
  dataSummary: string,
  elapsedMs: number,
): GoalExplorerResult {
  const classification = classifyArchetype(workflowName, platformType, selectedEntities);

  // Determine proposal count from data (same logic as current generateProposals)
  let proposalCount = 3;
  if (data) {
    switch (data.dataRichness) {
      case 'minimal': proposalCount = 1; break;
      case 'sparse': proposalCount = 2; break;
      case 'moderate': proposalCount = Math.min(3, data.eventTypes.length >= 2 ? 3 : 2); break;
      case 'rich': proposalCount = 3; break;
    }
  }

  // ── Derive chartTypes from data (data-aware fallback) ─────────────
  // Even without an LLM, we know what the data supports.
  // This ensures fallback proposals have rich wireframes, not just a KPI stub.
  const fallbackChartTypes: Array<'kpi' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'status_grid'> = ['kpi'];
  if (data?.canSupportTimeseries) {
    fallbackChartTypes.push('line_chart');
  }
  if (data?.canSupportBreakdowns) {
    fallbackChartTypes.push('bar_chart');
  }
  if ((data?.usableFieldCount ?? 0) > 3) {
    fallbackChartTypes.push('table');
  }
  // If status field exists, add status_grid
  if (data?.fieldShapes && Object.values(data.fieldShapes).includes('status')) {
    fallbackChartTypes.push('status_grid');
  }

  // ── Derive focusMetrics from field shapes ─────────────────────────
  const fallbackFocusMetrics: string[] = [];
  if (data?.availableFields) {
    for (const field of data.availableFields) {
      const shape = data.fieldShapes[field];
      // Include status, duration, numeric, and timestamp fields — skip identifiers and generic text
      if (shape && ['status', 'duration', 'numeric', 'timestamp'].includes(shape)) {
        fallbackFocusMetrics.push(field);
      }
    }
  }

  // ── Derive pitch from data ────────────────────────────────────────
  const fallbackPitch = data
    ? `Track ${data.totalEvents} ${data.eventTypes.join('/')} events across ${data.usableFieldCount} data dimensions.${
        data.canSupportTimeseries ? ' Includes time-series trends.' : ''
      }${data.canSupportBreakdowns ? ' Supports categorical breakdowns.' : ''}`
    : '';

  // Convert archetype presets → ProposalGoal[]
  const goals: ProposalGoal[] = classification.blendPresets
    .slice(0, proposalCount)
    .map((blend, i) => ({
      title: classification.titleTemplates[i] || `Proposal ${i + 1}`,
      pitch: fallbackPitch,
      focusMetrics: fallbackFocusMetrics,
      chartTypes: fallbackChartTypes,
      emphasis: blend,
    }));

  return {
    category: classification.archetype,
    confidence: classification.confidence,
    reasoning: `Keyword fallback: matched [${classification.matchedSignals.join(', ')}]`,
    proposalCount,
    goals,
    dataSummary,
    explorerMs: elapsedMs,
    source: 'fallback',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * LLM-powered Goal Explorer.
 *
 * Sends the actual data profile to an LLM and asks: "Given THIS data,
 * what dashboard proposals make sense?"
 *
 * Falls back to classifyArchetype() if:
 * - No data available (minimal/no events)
 * - LLM call fails or times out
 * - LLM returns unparseable output
 *
 * @param workflowName - Workflow display name
 * @param platformType - Platform slug (n8n, make, vapi, retell)
 * @param selectedEntities - Comma-separated entity names
 * @param data - Data availability assessment (from assessDataAvailability)
 * @returns GoalExplorerResult with proposal goals, category, and blends
 */
export async function exploreGoals(
  workflowName: string,
  platformType: string,
  selectedEntities: string,
  data: DataAvailability | null,
): Promise<GoalExplorerResult> {
  const start = Date.now();

  // ── Fast path: no data → keyword fallback immediately ─────────────
  if (!data || data.totalEvents === 0 || data.dataRichness === 'minimal') {
    console.log('[goalExplorer] No data or minimal data — using keyword fallback');
    const summary = data ? buildDataSummary(workflowName, platformType, selectedEntities, data) : 'No event data available.';
    return buildFallbackResult(workflowName, platformType, selectedEntities, data, summary, Date.now() - start);
  }

  // ── Build data summary (LIDA Summarizer step) ─────────────────────
  const dataSummary = buildDataSummary(workflowName, platformType, selectedEntities, data);
  console.log(`[goalExplorer] Data summary:\n${dataSummary}`);

  // ── Call LLM with structured output (retry once on failure) ───────
  const model = getModelById('gemini-3-pro-preview');
  const prompt = buildExplorerPrompt(dataSummary);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema: GoalExplorerOutputSchema,
        prompt,
        temperature: attempt === 0 ? 0.3 : 0, // Retry with temp 0
        maxOutputTokens: 1500,
      });

      const elapsed = Date.now() - start;
      const obj = result.object;
      console.log(`[goalExplorer] LLM responded in ${elapsed}ms (attempt ${attempt + 1})`);

      // ── Validate goals against actual data ───────────────────────
      // Enforce data-richness caps regardless of what the LLM says
      let proposalCount = obj.proposalCount;
      if (data.totalEvents < 10) proposalCount = Math.min(proposalCount, 1);
      else if (data.totalEvents < 50 || data.dataRichness === 'sparse') proposalCount = Math.min(proposalCount, 2);

      const goals: ProposalGoal[] = obj.goals.slice(0, proposalCount).map((goal) => {
        // Validate focusMetrics exist in actual data
        const focusMetrics = goal.focusMetrics.filter((m) =>
          data.availableFields.includes(m) || ['totalEvents', 'eventTypes'].includes(m)
        );

        // Normalize emphasis to sum to 1.0
        const d = goal.emphasis.dashboard || 0;
        const p = goal.emphasis.product || 0;
        const a = goal.emphasis.analytics || 0;
        const total = d + p + a;
        const emphasis: EmphasisBlend = total > 0
          ? {
              dashboard: Math.round((d / total) * 100) / 100,
              product: Math.round((p / total) * 100) / 100,
              analytics: Math.round((a / total) * 100) / 100,
            }
          : { dashboard: 0.6, product: 0.2, analytics: 0.2 };

        return {
          title: goal.title,
          pitch: goal.pitch,
          focusMetrics,
          chartTypes: goal.chartTypes,
          emphasis,
        };
      });

      if (goals.length === 0) {
        console.warn(`[goalExplorer] LLM returned 0 valid goals (attempt ${attempt + 1})`);
        continue; // Retry
      }

      console.log(`[goalExplorer] ✅ LLM classified as "${obj.category}" (${obj.confidence}) with ${goals.length} goals`);

      return {
        category: VALID_ARCHETYPES.includes(obj.category) ? obj.category : 'general',
        confidence: Math.min(1, Math.max(0, obj.confidence)),
        reasoning: obj.reasoning || 'LLM provided no reasoning.',
        proposalCount: goals.length,
        goals,
        dataSummary,
        explorerMs: elapsed,
        source: 'llm' as const,
      };
    } catch (err: unknown) {
      const elapsed = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[goalExplorer] LLM call failed (attempt ${attempt + 1}) after ${elapsed}ms:`, message);

      if (attempt === 0) {
        console.log('[goalExplorer] Retrying with temperature 0...');
        continue;
      }

      // Both attempts failed — fall back
      return buildFallbackResult(workflowName, platformType, selectedEntities, data, dataSummary, elapsed);
    }
  }

  // Should not reach here, but safety fallback
  return buildFallbackResult(workflowName, platformType, selectedEntities, data, dataSummary, Date.now() - start);
}
