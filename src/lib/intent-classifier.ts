// src/lib/intent-classifier.ts
//
// LLM-based intent classification — replaces regex catalogs.
// CODE decides what to do with the result. LLM only classifies.
//
import { z } from 'zod';

// ─── Phase-specific intent enums ─────────────────────────────────────────────

export const StyleIntentSchema = z.object({
  intent: z.enum([
    'confirm', // User accepts the current style ("yes", "looks good", "I selected Swiss Logic Monitor", "love it")
    'refine', // User wants changes ("make it darker", "try different colors", "more minimal", "I don't like the fonts")
    'advance', // User wants to skip ahead ("generate preview", "build the dashboard", "move on", "next step")
    'question', // User has a question ("what fonts does this use?", "can I change colors later?", "explain this palette")
    'other', // Unrelated or ambiguous
  ]),
  confidence: z.number().min(0).max(1),
});

export type StyleIntent = z.infer<typeof StyleIntentSchema>;

// ─── Generic classifier function ─────────────────────────────────────────────

export type IntentClassifierConfig = {
  phase: string;
  contextHint: string; // e.g. "They have style 'Swiss Logic Monitor' loaded"
  schema: z.ZodType<any>; // Phase-specific schema
  userMessage: string;
};

/**
 * classifyIntent — Uses structured output to classify user intent.
 *
 * This is NOT an agent call. It's a single, fast, deterministic LLM call
 * with structured output. The LLM returns an enum + confidence.
 * CODE routes based on the enum. LLM never decides what happens next.
 *
 * Cost: ~200ms with gpt-4.1-nano, ~100 tokens
 */
export async function classifyIntent(
  config: IntentClassifierConfig,
  mastra: any,
): Promise<{ intent: string; confidence: number }> {
  const startMs = Date.now();

  try {
    // Use the Mastra instance to get access to a lightweight agent for structured output.
    // We create a minimal agent inline — no tools, no memory, no side effects.
    const { Agent } = await import('@mastra/core/agent');

    const classifierAgent = new Agent({
      id: `intent-classifier-${config.phase}`,
      name: `Intent Classifier (${config.phase})`,
      instructions: [
        `You are an intent classifier. You receive a user message and classify it into exactly one intent category.`,
        `You ONLY output the structured JSON — no explanation, no commentary.`,
        `Current phase: ${config.phase}`,
        `Context: ${config.contextHint}`,
        ``,
        `CLASSIFICATION RULES:`,
        `- "confirm" = user accepts/approves the current state (yes, looks good, perfect, I selected X, love it, this works)`,
        `- "refine" = user wants changes to the current state (darker, different, change X, don't like Y, try again, more minimal)`,
        `- "advance" = user wants to move to the next phase (generate preview, build it, next step, move on, let's go — when said AFTER seeing results)`,
        `- "question" = user is asking about the current state without confirming or rejecting (what font is this, explain this, how does X work)`,
        `- "other" = doesn't fit any above category`,
        ``,
        `IMPORTANT: "confirm" and "advance" both mean the user is DONE with this phase.`,
        `If confidence < 0.6, classify as "other" to let the conversational agent handle it.`,
      ].join('\n'),
      model: 'openai/gpt-4.1-nano',
    });

    const result = await classifierAgent.generate(
      `Classify this user message: "${config.userMessage}"`,
      {
        structuredOutput: {
          schema: config.schema,
        },
        modelSettings: {
          temperature: 0,
        },
        maxSteps: 1,
      },
    );

    const classification = result.object;
    const elapsed = Date.now() - startMs;

    console.log(
      `[intent-classifier:${config.phase}] ${elapsed}ms | intent="${classification?.intent}" confidence=${classification?.confidence} | msg="${config.userMessage.substring(0, 60)}"`,
    );

    if (!classification || !classification.intent) {
      console.warn(`[intent-classifier:${config.phase}] No classification returned, defaulting to "other"`);
      return { intent: 'other', confidence: 0 };
    }

    return {
      intent: classification.intent,
      confidence: classification.confidence ?? 0.5,
    };
  } catch (err: any) {
    const elapsed = Date.now() - startMs;
    console.error(`[intent-classifier:${config.phase}] FAILED in ${elapsed}ms:`, err?.message || err);
    // On failure, return "other" so the agent loop handles it as fallback
    return { intent: 'other', confidence: 0 };
  }
}

// ─── Convenience: Style phase classifier ─────────────────────────────────────

export async function classifyStyleIntent(
  userMessage: string,
  currentStyleName: string | null,
  mastra: any,
): Promise<StyleIntent> {
  const result = await classifyIntent(
    {
      phase: 'style',
      contextHint: currentStyleName
        ? `User has been shown a design system called "${currentStyleName}". Design tokens are loaded in the database.`
        : `User is in the style selection phase. No style has been generated yet.`,
      schema: StyleIntentSchema,
      userMessage,
    },
    mastra,
  );

  return result as StyleIntent;
}

// ─── Phase 1: Select Entity ─────────────────────────────────────────────────

export const SelectEntityIntentSchema = z.object({
  intent: z.enum([
    'select', // User picked entities ("I want to track leads and ROI", "leads + pipeline stages", "all three", "the first two")
    'question', // User has questions ("what are entities?", "what does ROI metrics track?", "explain pipeline stages")
    'confused', // User doesn't understand or needs more guidance ("I'm not sure", "what do you recommend?", "help me choose")
    'other', // Unrelated or ambiguous
  ]),
  confidence: z.number().min(0).max(1),
});

export type SelectEntityIntent = z.infer<typeof SelectEntityIntentSchema>;

export async function classifySelectEntityIntent(
  userMessage: string,
  availableEntities: string[] | null,
  mastra: any,
): Promise<SelectEntityIntent> {
  const result = await classifyIntent(
    {
      phase: 'select_entity',
      contextHint: availableEntities?.length
        ? `User has been presented with these entities to choose from: ${availableEntities.join(', ')}. They can select one or more.`
        : `User is in entity selection. The system is analyzing their workflow to find trackable entities.`,
      schema: SelectEntityIntentSchema,
      userMessage,
    },
    mastra,
  );
  return result as SelectEntityIntent;
}

// ─── Phase 2: Recommend (Outcome + Wireframe) ──────────────────────────────

export const RecommendIntentSchema = z.object({
  intent: z.enum([
    'select_dashboard', // User chose Dashboard outcome ("dashboard", "I want a dashboard", "the first one", "retention")
    'select_product', // User chose Product/SaaS outcome ("product", "SaaS wrapper", "the second one", "sell access")
    'confirm', // User confirms wireframe ("looks good", "yes", "perfect", "let's go", "that works")
    'refine', // User wants wireframe changes ("add a pie chart", "show costs too", "swap the bottom section", "more metrics")
    'question', // User has questions ("what's the difference?", "which do you recommend?", "what does product mean?")
    'other', // Unrelated or ambiguous
  ]),
  confidence: z.number().min(0).max(1),
});

export type RecommendIntent = z.infer<typeof RecommendIntentSchema>;

export async function classifyRecommendIntent(
  userMessage: string,
  hasOutcome: boolean,
  wireframeShown: boolean,
  mastra: any,
): Promise<RecommendIntent> {
  let contextHint: string;
  if (!hasOutcome) {
    contextHint = 'User is choosing between Dashboard (client retention, showing value) and Product (SaaS wrapper, selling access). They have NOT picked yet.';
  } else if (!wireframeShown) {
    contextHint = 'User has selected an outcome. The system is generating a wireframe preview for them.';
  } else {
    contextHint = 'User has been shown a wireframe preview of their dashboard layout. They need to confirm it or request changes before moving to style selection.';
  }

  const result = await classifyIntent(
    {
      phase: 'recommend',
      contextHint,
      schema: RecommendIntentSchema,
      userMessage,
    },
    mastra,
  );
  return result as RecommendIntent;
}

// ─── Phase 4: Build Preview ─────────────────────────────────────────────────

export const BuildPreviewIntentSchema = z.object({
  intent: z.enum([
    'generate', // User wants to generate/regenerate preview ("generate it", "build the dashboard", "show me", "create preview", "try again")
    'question', // User has questions about the preview process ("how long?", "what data will it use?", "will it use my colors?")
    'other', // Unrelated or ambiguous
  ]),
  confidence: z.number().min(0).max(1),
});

export type BuildPreviewIntent = z.infer<typeof BuildPreviewIntentSchema>;

export async function classifyBuildPreviewIntent(
  userMessage: string,
  hasPreview: boolean,
  mastra: any,
): Promise<BuildPreviewIntent> {
  const result = await classifyIntent(
    {
      phase: 'build_preview',
      contextHint: hasPreview
        ? 'A dashboard preview has already been generated. User might want to regenerate it or has questions.'
        : 'No preview has been generated yet. The system is ready to build a dashboard preview from their selected entities, outcome, and style.',
      schema: BuildPreviewIntentSchema,
      userMessage,
    },
    mastra,
  );
  return result as BuildPreviewIntent;
}

// ─── Phase 5: Interactive Edit ──────────────────────────────────────────────

export const InteractiveEditIntentSchema = z.object({
  intent: z.enum([
    'edit', // User wants to change something ("make it darker", "change the title", "swap the chart", "add a metric", "remove the table")
    'deploy', // User is done editing and wants to deploy ("deploy", "ship it", "looks good let's go live", "I'm happy with it", "done")
    'question', // User has questions ("can I change the font?", "how do I add a chart?", "what edits can I make?")
    'other', // Unrelated or ambiguous
  ]),
  confidence: z.number().min(0).max(1),
});

export type InteractiveEditIntent = z.infer<typeof InteractiveEditIntentSchema>;

export async function classifyInteractiveEditIntent(
  userMessage: string,
  mastra: any,
): Promise<InteractiveEditIntent> {
  const result = await classifyIntent(
    {
      phase: 'interactive_edit',
      contextHint: 'User has a live dashboard preview and can request edits (layout, style, copy changes) or confirm they are ready to deploy.',
      schema: InteractiveEditIntentSchema,
      userMessage,
    },
    mastra,
  );
  return result as InteractiveEditIntent;
}

// ─── Phase 6: Deploy ────────────────────────────────────────────────────────

export const DeployIntentSchema = z.object({
  intent: z.enum([
    'confirm', // User confirms deployment ("yes", "confirm", "deploy", "go live", "do it", "ship it")
    'cancel', // User wants to go back or cancel ("wait", "go back", "not yet", "let me edit more", "cancel")
    'question', // User has questions ("where will it be hosted?", "can I edit after deploy?", "what URL will it have?")
    'other', // Unrelated or ambiguous
  ]),
  confidence: z.number().min(0).max(1),
});

export type DeployIntent = z.infer<typeof DeployIntentSchema>;

export async function classifyDeployIntent(
  userMessage: string,
  mastra: any,
): Promise<DeployIntent> {
  const result = await classifyIntent(
    {
      phase: 'deploy',
      contextHint: 'User is at the final deployment step. They need to explicitly confirm to deploy their dashboard to a live client portal URL.',
      schema: DeployIntentSchema,
      userMessage,
    },
    mastra,
  );
  return result as DeployIntent;
}
