import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { RuntimeContext } from "../core/RuntimeContext";
import { loadSkill } from "../skills/loadSkill";

import {
  appendThreadEvent,
  getClientContext,
  getRecentEventSamples,
  getSchemaSummary,
  listTemplates,
  recommendTemplates,
  proposeMapping,
  saveMapping,
  runGeneratePreviewWorkflow,
} from "../tools/platformMapping";

type PlatformType =
  | "vapi"
  | "retell"
  | "n8n"
  | "mastra"
  | "crewai"
  | "pydantic_ai"
  | "other";

export const platformMappingAgent = new Agent({
  name: "Platform Mapping Agent",
  description:
    "Schema→template→mapping specialist. Uses real event samples and deterministic tools to recommend templates, propose/save mappings, and trigger preview runs.",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    const platformType = (runtimeContext.get("platformType") as PlatformType) || "other";
    const skill = await loadSkill(platformType);

    return [
      {
        role: "system",
        content:
          "You are the Platform Mapping Agent for GetFlowetic.\n\n" +
          "MISSION: Get the user from connected platform -> working dashboard preview fast.\n\n" +
          "HARD RULES:\n" +
          "- Never ask the user for tenantId, userId, sourceId, interfaceId, or any UUID.\n" +
          "- Never claim a field exists unless you checked via tools (event samples/schema summary).\n" +
          "- Never show raw JSON unless the user explicitly asks.\n" +
          "- Prefer deterministic tools; keep user-facing answers short.\n\n" +
          "OUTPUT:\n" +
          "- End every response with ONE next-step CTA OR ONE clarifying question.\n" +
          "- Write brief rationale events using appendThreadEvent (1–2 sentences).\n",
      },
      {
        role: "system",
        content:
          "Deterministic platform skill (selected by system, not the model):\n\n" + skill,
      },
      {
        role: "system",
        content:
          "TOOL FLOW (use this order when user wants preview/template/mapping):\n" +
          "1) getClientContext(tenantId)\n" +
          "2) getRecentEventSamples(tenantId, sourceId, lastN)\n" +
          "3) getSchemaSummary(tenantId, sourceId) OR derive from samples per tool\n" +
          "4) listTemplates(platformType)\n" +
          "5) recommendTemplates(platformType, schemaSummary)\n" +
          "6) proposeMapping(platformType, templateId, schemaFields)\n" +
          "7) saveMapping(tenantId,userId,interfaceId,templateId,mappings,confidence,metadata)\n" +
          "8) runGeneratePreviewWorkflow(...) when user requests preview\n\n" +
          "If required fields are missing, explain the missing field(s) in plain language and ask ONE question.\n",
      },
    ];
  },
  model: openai("gpt-4o"),
  tools: {
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    getSchemaSummary,
    listTemplates,
    recommendTemplates,
    proposeMapping,
    saveMapping,
    runGeneratePreviewWorkflow,
  },
});
