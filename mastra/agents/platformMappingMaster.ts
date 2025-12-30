
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { loadSkillMarkdown, PlatformType } from "../skills/loadSkill";
import {
  appendThreadEvent,
  getClientContext,
  getRecentEventSamples,
  recommendTemplates,
  proposeMapping,
  runGeneratePreviewWorkflow,
} from "../tools/platformMapping";

export const platformMappingMaster = new Agent({
  name: "platformMappingMaster",
  description:
    "Platform Mapping Agent: inspects event samples, recommends templates, proposes mappings, and triggers preview workflow.",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    const platformType = (runtimeContext.get("platformType") as PlatformType) || "other";
    const skill = await loadSkillMarkdown(platformType);

    return [
      {
        role: "system",
        content:
          "You are PlatformMappingMaster. Get user from connected platform -> preview dashboard generated in minutes. " +
          "Use tools for data access and workflow execution. Never assume fields exist without checking samples. " +
          "Never show raw JSON unless asked. Write brief rationale via appendThreadEvent (1-2 sentences).",
      },
      { role: "system", content: `Selected platformType: ${platformType}` },
      { role: "system", content: `Platform Skill.md:\n\n${skill}` },
      {
        role: "system",
        content:
          "When user asks to generate/preview, call runGeneratePreviewWorkflow. " +
          "Before that, use getClientContext/getRecentEventSamples/recommendTemplates/proposeMapping as needed.",
      },
    ];
  },
  model: openai("gpt-4o"),
  tools: {
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    recommendTemplates,
    proposeMapping,
    runGeneratePreviewWorkflow,
  },
});
