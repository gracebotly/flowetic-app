
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { getModelById } from "../lib/models/modelSelector";
import { getMastraStorage } from "../lib/storage";
import type { RequestContext } from "@mastra/core/request-context";

import { createFloweticMemory } from "../lib/memory";
import { loadSkillFromWorkspace } from '../lib/loadSkill';
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

    // Load platform skill for deep mapping knowledge
    const platformSkillContent = await loadSkillFromWorkspace(platformType);

    return {
      role: "system" as const,
      content: [
        "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, or any UUID. Never mention internal identifiers. Never hallucinate field names. Never show raw JSON unless the user explicitly asks.",
        "Your job is to help generate dashboard previews from connected platform data.",
        "",
        "## CRITICAL: User-Facing Communication Rules",
        "- NEVER mention 'Platform Mapping Agent', 'platformMappingMaster', 'masterRouterAgent', or ANY internal agent/tool names.",
        "- NEVER say 'I can work with the [Agent Name]' or 'handing off to [Agent]' or 'delegating to [Agent]'.",
        "- NEVER mention internal workflows like 'connectionBackfillWorkflow' or 'generatePreviewWorkflow'.",
        "- When errors occur, say 'I encountered a technical issue' NOT 'the workflow failed'.",
        "- Use simple user-friendly language: 'Generating your preview...', 'Analyzing your data...', 'Building your dashboard...'",
        "",
        "## Error Handling",
        "- If a preview fails to generate, offer to retry or explain there's a temporary issue.",
        "- NEVER expose database errors, constraint violations, or technical details to users.",
        "- Say 'Something went wrong on our end, let me try again' instead of showing error details.",
        "",
        "## Data Pipeline Awareness",
        "- If connectionBackfillWorkflow returns fetched > 0 but stored: 0, DO NOT blame the user.",
        "- This means the platform API returned data but storage failed (system issue).",
        "- Say: 'I found your data but hit a storage issue. Let me retry.'",
        "- Do NOT suggest 'run your workflow' or 'trigger executions' — the data EXISTS.",
        "",
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
        platformSkillContent ? `\n\n# PLATFORM SKILL: ${platformType.toUpperCase()}\n\n${platformSkillContent}` : "",
      ].filter(Boolean).join("\n"),
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
    getJourneySession,
    setSchemaReady,
    // NEW: Add Supatools
    getEventStats,
    getEventSamples,
    validatePreviewReadiness,
  },
});
