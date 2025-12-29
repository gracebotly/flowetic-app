import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { analyzeSchema } from '../tools/analyzeSchema';
import { selectTemplate } from '../tools/selectTemplate';
import { generateMapping } from '../tools/generateMapping';
import { generateUISpec } from '../tools/generateUISpec';
import { validateSpec } from '../tools/validateSpec';
import { persistPreviewVersion } from '../tools/persistPreviewVersion';

/**
 * Platform Mapping Agent
 *
 * This agent helps users transform their connected platform data into a ready‑to‑preview dashboard.
 * It should:
 * 1. Analyze the event schema via `analyzeSchema`.
 * 2. Select the appropriate dashboard template using `selectTemplate`.
 * 3. Generate field mappings with `generateMapping`.
 * 4. Create a UI spec using `generateUISpec`.
 * 5. Validate the spec using `validateSpec`, halting if it fails.
 * 6. Persist the preview version using `persistPreviewVersion` and return the preview URL.
 * The agent must only provide concise summaries and never expose raw JSON.
 */
export const platformMappingAgent = new Agent({
  name: 'Platform Mapping Agent',
  instructions: `
You are the Platform Mapping Agent for GetFlowetic. Your job is to convert a connected platform’s events
into a dashboard preview. Follow these steps deterministically:
1. Call analyzeSchema to inspect the event schema.
2. Call selectTemplate to choose the best template based on platform type and event types.
3. Call generateMapping to align platform fields with template fields.
4. Call generateUISpec using the template and mappings.
5. Call validateSpec; if invalid or low scoring, return an error message.
6. Call persistPreviewVersion to save the spec and receive a preview URL.
Respond with a brief summary and the preview URL. Never reveal raw JSON or internal IDs.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    analyzeSchema,
    selectTemplate,
    generateMapping,
    generateUISpec,
    validateSpec,
    persistPreviewVersion,
  },
});
