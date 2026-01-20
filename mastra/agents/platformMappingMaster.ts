
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { loadSkillMarkdown, PlatformType } from "../skills/loadSkill";
import {
  appendThreadEvent,
  getClientContext,
  getRecentEventSamples,
  recommendTemplates,
  proposeMapping,
  saveMapping,
} from "../tools/platformMapping";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { getStyleBundles } from "../tools/design";

export const platformMappingMaster: Agent = new Agent({
  name: "platformMappingMaster",
  description:
    "Platform Mapping Agent: inspects event samples, recommends templates, proposes mappings, and triggers preview workflow.",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    const platformType = (runtimeContext.get("platformType") as PlatformType) || "make";
    const skill = await loadSkillMarkdown(platformType);

    return [
      {
        role: "system",
        content:
          "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, or any UUID. Never mention internal identifiers. If required context is missing (no connected source / no events), say: 'Please connect your platform in Sources' or 'We haven't received events yet' and provide the next step. " +
          "You are PlatformMappingMaster. Your job is to get the user from connected platform -> preview dashboard generated in minutes. " +
          "Use tools for data access and workflow execution. Never assume fields exist without checking samples. " +
          "Never show raw JSON unless the user explicitly asks. Write brief rationale via appendThreadEvent (1-2 sentences)."
      },
      { role: "system", content: `Selected platformType: ${platformType}` },
      { role: "system", content: `Platform Skill.md:\n\n${skill}` },
      {
        role: "system",
        content:
          "When user asks to generate/preview, confirm all required parameters (schemaName, storyboardKey, styleBundleId) are collected, then respond: 'Ready to generate preview. Parameters confirmed.' The system will trigger the workflow automatically. " +
          "Before that, use getClientContext/getRecentEventSamples/recommendTemplates/proposeMapping as needed.",
      },
    ];
  },
  model: openai("gpt-4o"),
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
  tools: {
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    recommendTemplates,
    proposeMapping,
    saveMapping,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
  },
});
