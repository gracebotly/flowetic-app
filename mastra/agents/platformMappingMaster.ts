
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
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
    const platformType = (requestContext.get("platformType") as PlatformType) || "make";
    const skill = await loadSkillMarkdown(platformType);

    return [
      {
        role: "system",
        content:
          "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, or any UUID. Never mention internal identifiers. Never hallucinate field names. Never show raw JSON unless the user explicitly asks. " +
          "You are PlatformMappingMaster. Your job is to get the user from connected platform -> preview dashboard generated in minutes. " +
          "SCHEMA READINESS GATE: You MUST check journey.getSession. If schemaReady is false, you MUST run connectionBackfillWorkflow first, then set journey.setSchemaReady(schemaReady=true), then proceed. " +
          "Before proposing mapping, use getRecentEventSamples + recommendTemplates + proposeMapping as needed. " +
          "Write brief rationale via appendThreadEvent (1-2 sentences)."
      },
      { role: "system", content: `Selected platformType: ${platformType}` },
      { role: "system", content: `Platform Skill.md:\n\n${skill}` },
      {
        role: "system",
        content:
          "When user asks to generate/preview, call runGeneratePreviewWorkflow only AFTER schemaReady is true and mapping is complete.",
      },
    ];
  },
  model: glm47Model(),

  workflows: {
    connectionBackfillWorkflow,
  },

  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
  tools: {
    // new gating tools
    getJourneySession,
    setSchemaReady,

    // existing platform mapping tools
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    recommendTemplates,
    proposeMapping,
    saveMapping,
    runGeneratePreviewWorkflow,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
  },
});
