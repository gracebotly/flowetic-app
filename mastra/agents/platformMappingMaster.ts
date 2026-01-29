
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import type { RequestContext } from "@mastra/core/request-context";
import { loadSkillMarkdown, PlatformType } from "../skills/loadSkill";
import {
  appendThreadEvent,
  getClientContext,
  getRecentEventSamples,
  recommendTemplates,
  proposeMapping,
  saveMapping,
  runGeneratePreviewWorkflow,
} from "../tools/platformMapping";
import { analyzeSchema } from "../tools/analyzeSchema";
import { generateMapping } from "../tools/generateMapping";
import { getSchemaSummary } from "../tools/platformMapping/getSchemaSummary";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
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
    ) as PlatformType;
    
    const skill = await loadSkillMarkdown(platformType);

    return {
      role: "system" as const,
      content: [
        "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, or any UUID. Never mention internal identifiers. Never hallucinate field names. Never show raw JSON unless the user explicitly asks.",
        "You are PlatformMappingMaster. Your job is to get the user from connected platform -> preview dashboard generated in minutes.",
        "SCHEMA READINESS GATE: You MUST check journey.getSession. If schemaReady is false, you MUST run connectionBackfillWorkflow first, then set journey.setSchemaReady(schemaReady=true), then proceed.",
        "Before proposing mapping, use getRecentEventSamples + recommendTemplates + proposeMapping as needed.",
        "Write brief rationale via appendThreadEvent (1-2 sentences).",
        `Selected platformType: ${platformType}`,
        `Platform Skill.md:\n\n${skill}`,
        "When user asks to generate/preview, call runGeneratePreviewWorkflow only AFTER schemaReady is true and mapping is complete.",
        "BEHAVIOR:",
        "- When you have enough information to proceed, proceed without asking for confirmation.",
        "- Only suspend / ask a question when a required mapping field is missing or schemaReady is false.",
      ].join("\n"),
    };
  },
  model: glm47Model(),
  workflows: {
    connectionBackfillWorkflow,
  },
  memory: new Memory({
    storage: getMastraStorage(),
    options: {
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
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: "resource",
      },
    },
  }),
  tools: {
    analyzeSchema,
    generateMapping,
    getSchemaSummary,
    // Keep existing tools
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    recommendTemplates,
    proposeMapping,
    saveMapping,
    runGeneratePreviewWorkflow,
    // Todo tools
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
    // Design tools
    getStyleBundles,
    // Journey tools
    getJourneySession,
    setSchemaReady,
  },
});
