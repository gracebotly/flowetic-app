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
