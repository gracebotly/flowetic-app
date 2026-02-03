
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { getModelById } from "../lib/models/modelSelector";
import { getMastraStorage } from "../lib/storage";
import type { RequestContext } from "@mastra/core/request-context";

import { createFloweticMemory } from "../lib/memory";
import {
  appendThreadEvent,
  getClientContext,
  getRecentEventSamples,
  recommendTemplates,
  proposeMapping,
  saveMapping,
  runGeneratePreviewWorkflow,
  // NEW: Add Supatools
  getEventStats,
  getEventSamples,
  validatePreviewReadiness,
} from "../tools/platformMapping";
import { analyzeSchema } from "../tools/analyzeSchema";
import { generateMapping } from "../tools/generateMapping";
import { getSchemaSummary } from "../tools/platformMapping/getSchemaSummary";

import { getStyleBundles } from "../tools/design";
import { getJourneySession } from "../tools/journey/getJourneySession";
import { setSchemaReady } from "../tools/journey/setSchemaReady";
import { connectionBackfillWorkflow } from "../workflows/connectionBackfill";


export const platformMappingMaster: Agent = new Agent({
  id: "platformMappingMaster",
  name: "platformMappingMaster",
  description:
    "Platform Mapping Agent: inspects event samples, recommends templates, proposes mappings, and triggers preview workflow. Triggers connection backfill when schema is not ready.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    const platformType = (
      (typeof requestContext?.get === 'function' 
        ? requestContext.get("platformType") 
        : (requestContext as any)?.platformType) || "make"
    );

    return {
      role: "system" as const,
      content: [
        "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, or any UUID. Never mention internal identifiers. Never hallucinate field names. Never show raw JSON unless the user explicitly asks.",
        "You are PlatformMappingMaster. Your job is to get the user from connected platform -> preview dashboard generated in minutes.",
        "SCHEMA READINESS GATE: You MUST check journey.getSession. If schemaReady is false, you MUST tell the user you need to sync data from their platform. Explain this takes 30-60 seconds and is required to generate their preview. Use appendThreadEvent to create an ACTION BUTTON for the user to click. DO NOT run connectionBackfillWorkflow yourself - it will be triggered separately when the user clicks the button. Wait for the user to confirm the backfill is complete before proceeding.",
        "PREVIEW READINESS GATE: Before running runGeneratePreviewWorkflow, you MUST call validatePreviewReadiness to ensure all prerequisites are met. If blockers exist, explain them to the user and do not proceed.",
        "Before proposing mapping, use getEventStats + getEventSamples + getRecentEventSamples + recommendTemplates + proposeMapping as needed.",
        "Write brief rationale via appendThreadEvent (1-2 sentences).",
        `Selected platformType: ${platformType}`,
        "Note: Platform-specific skills are now discovered automatically by Workspace",
        "When user asks to generate/preview, call runGeneratePreviewWorkflow only AFTER schemaReady is true and mapping is complete.",
        "BEHAVIOR:",
        "- When you have enough information to proceed, proceed without asking for confirmation.",
        "- Only suspend / ask a question when a required mapping field is missing or schemaReady is false.",
      ].join("\n"),
    };
  },
  model: ({ requestContext }: { requestContext: RequestContext }) => {
    const selectedModelId = requestContext.get("selectedModel") as string | undefined;
    return getModelById(selectedModelId);
  },
  workflows: {
    connectionBackfillWorkflow,
  },
  memory: createFloweticMemory({
    lastMessages: 30,
    workingMemory: {
      enabled: true,
      template: `# Mapping Session
- platformType:
- schemaReady:
- chosenTemplateId:
- mappingConfidence:
- missingFields:
- lastDecision:
`,
    },
  }),
  tools: {
    analyzeSchema,
    generateMapping,
    getSchemaSummary,
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    recommendTemplates,
    proposeMapping,
    saveMapping,
    runGeneratePreviewWorkflow,
    getStyleBundles,
    getJourneySession,
    setSchemaReady,
    // NEW: Add Supatools
    getEventStats,
    getEventSamples,
    validatePreviewReadiness,
  },
});
