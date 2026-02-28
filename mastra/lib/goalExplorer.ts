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
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getModelById } from './models/modelSelector';
import { classifyArchetype } from './classifyArchetype';
import type {
  Archetype,
  EmphasisBlend,
  GoalExplorerResult,
  ProposalGoal,
} from '@/types/proposal';

// ─── Timeout + Cascade Fallback ──────────────────────────────────────────

/** Create a 45-second AbortSignal. Gemini 3.1 Pro Preview needs 25-35s for
 *  structured output. 45s keeps us within Vercel's 60s limit (45s LLM +
 *  ~10s overhead). The cascade to Flash still fires if Pro truly hangs. */
function goalExplorerTimeout(): AbortSignal {
  return AbortSignal.timeout(45_000);
}

/** Gemini 3 Flash — fast, cheap fallback for cascade retry. Same Gemini 3 family. */
function getCascadeFallbackModel() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  return google('gemini-3-flash-preview');
}

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
  insights: Array<{ metric: string; label: string; value: string | number; unit?: string }>;
  supportedGoals: string[];
  naturalSummary: string;
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
  lines.push('');

  // NEW: Include computed insights so LLM can reason about actual values
  if (data.insights && data.insights.length > 0) {
    lines.push('Computed statistics from actual data:');
    for (const insight of data.insights) {
      const unit = insight.unit ? ` ${insight.unit}` : '';
      lines.push(`  ${insight.label}: ${insight.value}${unit}`);
    }
    lines.push('');
  }

  // NEW: Include supported goals so LLM knows what's feasible
  if (data.supportedGoals && data.supportedGoals.length > 0) {
    lines.push(`Supported visualization goals: ${data.supportedGoals.join(', ')}`);
    lines.push('');
  }

  // NEW: Include the natural language summary for grounding
  if (data.naturalSummary && data.naturalSummary !== 'No event data available yet.') {
    lines.push(`Data summary: ${data.naturalSummary}`);
  }

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

  // ── Call LLM with structured output (cascade retry across models) ────
  //
  // Strategy: Try primary (Gemini 3.1 Pro) → fallback (Gemini 3 Flash).
  // Both are Gemini 3 family with native structured output support.
  // Each attempt has a 45s timeout to stay within Vercel's 60s limit.
  //
  // If BOTH fail → throw. No silent keyword fallback. Fail hard.
  //
  // Why cascade works:
  // - Gemini 3.1 Pro is in preview and experiencing 503 "high demand" errors
  // - Flash has separate capacity, is faster, and cheaper
  // - Same-model retry doesn't help provider-specific failures

  const prompt = buildExplorerPrompt(dataSummary);

  // Build model cascade: primary (3.1 Pro) → fallback (3 Flash)
  const primaryModel = getModelById(undefined); // Uses DEFAULT_MODEL_ID (gemini-3.1-pro-preview)
  const fallbackModel = getCascadeFallbackModel();

  const attempts: Array<{ label: string; model: any; temp: number }> = [
    { label: 'gemini-3.1-pro-preview', model: primaryModel, temp: 0.3 },
  ];
  if (fallbackModel) {
    attempts.push({ label: 'gemini-3-flash-preview (cascade)', model: fallbackModel, temp: 0 });
  }
  let lastError: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    const { label, model, temp } = attempts[i];
    try {
      console.log(`[goalExplorer] Attempt ${i + 1}/${attempts.length} using ${label}...`);

      const result = await generateObject({
        model,
        schema: GoalExplorerOutputSchema,
        prompt,
        temperature: temp,
        maxOutputTokens: 1500,
        abortSignal: goalExplorerTimeout(),
      });

      const elapsed = Date.now() - start;
      const obj = result.object;
      console.log(`[goalExplorer] LLM responded in ${elapsed}ms (${label})`);

      // ── Validate goals against actual data ───────────────────────
      let proposalCount = obj.proposalCount;
      if (data.totalEvents < 10) proposalCount = Math.min(proposalCount, 1);
      else if (data.totalEvents < 50 || data.dataRichness === 'sparse') proposalCount = Math.min(proposalCount, 2);

      const goals: ProposalGoal[] = obj.goals.slice(0, proposalCount).map((goal) => {
        const focusMetrics = goal.focusMetrics.filter((m) =>
          data.availableFields.includes(m) || ['totalEvents', 'eventTypes'].includes(m)
        );

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
        console.warn(`[goalExplorer] ${label} returned 0 valid goals — trying next`);
        continue;
      }

      console.log(`[goalExplorer] ✅ ${label} classified as "${obj.category}" (${obj.confidence}) with ${goals.length} goals`);

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
      lastError = err;
      const elapsed = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes('abort') || errMsg.includes('timeout') || errMsg.includes('TimeoutError');
      const isRateLimit = errMsg.includes('429') || errMsg.includes('503') || errMsg.includes('UNAVAILABLE');

      console.error(
        `[goalExplorer] ${label} failed after ${elapsed}ms:`,
        isTimeout ? 'TIMEOUT (45s limit)' : isRateLimit ? 'RATE LIMITED / OVERLOADED' : errMsg.slice(0, 200),
      );

      // If more attempts remain, cascade to next model
      if (i < attempts.length - 1) {
        console.log(`[goalExplorer] Cascading to next model...`);
        continue;
      }

      console.error(`[goalExplorer] Exhausted model attempts; falling back to keyword classification.`);
    }
  }

  // If we get here, all attempts failed — use keyword fallback instead of throwing.
  // The fallback produces data-aware proposals with proper chart types and focus metrics.
  // Throwing here would trigger agent fallback in handleDeterministicPropose, which is
  // architecturally wrong: the agent lacks the context to make propose-phase decisions.
  const lastErrorMessage = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error');
  console.warn(
    `[goalExplorer] ⚠️ All LLM models failed: ${lastErrorMessage}. ` +
    `Using keyword-based fallback (still produces data-aware proposals).`
  );
  return buildFallbackResult(workflowName, platformType, selectedEntities, data, dataSummary, Date.now() - start);
}
