

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import { getMastraStorage } from "../lib/storage";
import type { RequestContext } from "@mastra/core/request-context";
import { searchDesignDatabase } from "../tools/design-system/searchDesignDatabase";
import { generateDesignSystem } from "../tools/design-system/generateDesignSystem";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { getStyleBundles } from "../tools/design";

import { loadNamedSkillMarkdown } from "../skills/loadSkill";

export const designAdvisorAgent: Agent = new Agent({
  id: "designAdvisorAgent",
  name: "designAdvisorAgent",
  description:
    "Design Advisor Agent (RAG): Frontend-design powered UI/UX guidance. Generates style bundles (Phase 3), applies interactive edits (Phase 5), follows frontend-design principles for distinctive dashboards.",
  instructions: async ({ requestContext }: { requestContext: RequestContext }) => {
    const mode = (requestContext.get("mode") as string | undefined) ?? "edit";
    const phase = (requestContext.get("phase") as string | undefined) ?? "editing";
    const platformType = (requestContext.get("platformType") as string | undefined) ?? "make";
    
    // Load ui-ux-pro-max skill (replaces frontend-design)
    const skill = await loadNamedSkillMarkdown("ui-ux-pro-max");

    return [
      {
        role: "system",
        content: `UI/UX Pro Max Skill.md:\n\n${skill.content}`,
      },
      {
        role: "system",
        content:
          "You are the Design Advisor Agent (RAG) for GetFlowetic.\n\n" +
          "Goal: Make the dashboard look polished, modern, and appropriate for the user's brand (e.g., law firm, healthcare, startup) while staying consistent with the GetFlowetic component system.\n\n" +
          "CRITICAL RULES:\n" +
          "- Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID. Never mention internal identifiers.\n" +
          "Python RAG tools: Use searchDesignDatabase for domain-specific searches and generateDesignSystem for complete design systems. These execute Python scripts with BM25 search for professional design recommendations. Never mention the underlying tools; give grounded UI/UX guidance.\n" +
          "Never invent a design system. If retrieval is empty or low-quality, give conservative, broadly safe guidance and say it is a best-practice default.\n" +
          "- Prefer concrete edits: design tokens (colors, radius, spacing, typography), component prop defaults, and light layout tweaks.\n" +
          "- Do not show raw spec JSON unless explicitly requested.\n\n" +
          "PHASE GATING:\n" +
          "- Phase 3: Generate 4 style bundles using getStyleBundles tool\n" +
          "- Phase 5: Apply minimal token/layout tweaks (getCurrentSpec → applySpecPatch → validateSpec → savePreviewVersion)\n" +
          "- Never change template/platform without router direction\n" +
          "- Never produce raw JSON unless asked\n\n" +
          "When the user asks to 'make it more premium/minimal/bold', give 2-3 specific token changes (palette, radius, density) and explain the visual impact in plain language.\n" +
          "DEFAULT BEHAVIOR:\n" +
          "- If the user asks for a change (premium/minimal/bold), propose 2-3 concrete token edits and then proceed to apply them ONLY if you have an explicit tool path to apply changes in the current phase.\n" +
          "- If you do not have the tool path in this agent to apply changes, provide the recommendations and tell the user what will change in the preview once applied.",
      },
    ];
  },
  model: glm47Model(),
  memory: new Memory({
    storage: getMastraStorage(),
    options: {
      lastMessages: 30,
      workingMemory: {
        enabled: true,
        template: `# Design Preferences
- styleDirection:
- audience:
- density:
- palette:
- typographyNotes:
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
    // Use proper Python RAG tools instead of keyword search
    searchDesignDatabase,    // Python RAG domain search
    generateDesignSystem,    // Python design system generator
    
    // Keep existing todo tools
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
    
    // Keep style bundle tool
    getStyleBundles,
  },
});
