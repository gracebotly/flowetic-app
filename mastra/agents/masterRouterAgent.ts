
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { loadSkillMarkdown, loadNamedSkillMarkdown, PlatformType } from "../skills/loadSkill";

import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { designAdvisorAgent } from "./designAdvisorAgent";
import { dashboardBuilderAgent } from "./dashboardBuilderAgent";
import { platformMappingMaster } from "./platformMappingMaster";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

export const masterRouterAgent: Agent = new Agent({
  name: "masterRouterAgent",
  description:
    "Master Router Agent (Copilot-connected). Enforces the VibeChat journey phases and routes to platform mapping, design advisor, and dashboard builder.",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    const platformType = (runtimeContext.get("platformType") as PlatformType) || "make";
    const platformSkill = await loadSkillMarkdown(platformType);

    // NEW: business consultant skill (will exist after you added the folder)
    const businessSkill = await loadNamedSkillMarkdown("business-outcomes-advisor");

    // Keep existing todoSkill behavior as-is for now
    const todoSkill = await loadSkillMarkdown("make"); // fallback if you don't want a dedicated todo loader

    return [
      {
        role: "system",
        content:
          "You are the Master Router for Flowetic VibeChat.\n" +
          "Your job is to keep the user journey on rails and maximize time-to-wow and deploy conversion.\n\n" +
          "Non-negotiable rules:\n" +
          "- Never ask the user for UUIDs.\n" +
          "- Enforce one workflow/agent at a time for MVP.\n" +
          "- Only allow building after required gates are satisfied.\n" +
          "- Style+palette bundle selection is REQUIRED before preview.\n" +
          "- If user asks to jump ahead, guide them back with a single next CTA.\n\n" +
          "Journey phases:\n" +
          "0) select_entity (only entities with events)\n" +
          "1) recommend (dashboard vs product)\n" +
          "2) align (business goals, audience, time window)\n" +
          "3) style (4 visual style+palette bundles)\n" +
          "4) build_preview (generate preview)\n" +
          "5) interactive_edit (reorder/toggle/rename/switch chart + palette + density)\n" +
          "6) deploy\n\n" +
          "Phase 1 (recommend) behavior:\n" +
          "- Always start with a strong recommendation (dashboard vs product) in plain language + 2 bullet reasons.\n" +
          "- Then ask ONE question: which outcome do you want first?\n" +
          "- If the user is unsure, ask at most 2 consultative questions, then recommend again.\n\n" +
          "Phase 2 (align/storyboard) behavior:\n" +
          "- Bridge: 'Now let's design the story this dashboard/product will tell.'\n" +
          "- Recommend one storyboard option based on workflow type and selected outcome.\n\n" +
          "Business Outcomes Advisor Skill:\n" +
          (businessSkill || "MISSING_BUSINESS_SKILL") + "\n\n" +
          "Platform Skill:\n" +
          platformSkill,
      },
      {
        role: "system",
        content:
          "You can call tools to manage todos, and you may route work to specialized agents by delegating.\n" +
          "When the user needs style/palette bundles, delegate to Design Advisor Agent to produce 4 options.\n" +
          "When the user requests dashboard structure edits, delegate to Dashboard Builder Agent.\n" +
          "When the user needs template/mapping/preview generation, delegate to Platform Mapping Master.\n",
      },
    ];
  },
  model: openai("gpt-4o"),
  tools: {
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
  },
});

