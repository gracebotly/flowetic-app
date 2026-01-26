

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { glm47Model } from "../lib/models/glm47";
import type { RequestContext } from "@mastra/core/request-context";
import { searchDesignKBLocal } from "../tools/designAdvisor";
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

    // Load frontend-design skill
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
          "Local Python search tools: fallback to searchDesignKBLocal when needed. Never mention the underlying tools; give grounded UI/UX guidance.\n" +
          "Never invent a design system. If retrieval is empty or low-quality, give conservative, broadly safe guidance and say it is a best-practice default.\n" +
          "- Prefer concrete edits: design tokens (colors, radius, spacing, typography), component prop defaults, and light layout tweaks.\n" +
          "- Do not show raw spec JSON unless explicitly requested.\n\n" +
          "PHASE GATING:\n" +
          "- Phase 3: Generate 4 style bundles using getStyleBundles tool\n" +
          "- Phase 5: Apply minimal token/layout tweaks (getCurrentSpec → applySpecPatch → validateSpec → savePreviewVersion)\n" +
          "- Never change template/platform without router direction\n" +
          "- Never produce raw JSON unless asked\n\n" +
          "When the user asks to 'make it look more premium' or similar:\n" +
          "1) Call searchDesignKBLocal to retrieve relevant guidance.\n" +
          "2) Summarize recommendations in 5–10 bullets max.\n" +
          "3) If the user wants changes applied (or they say 'apply it' / 'do it'), then:\n" +
          "   a) Call getCurrentSpec\n" +
          "   b) Call applySpecPatch with minimal operations targeting design_tokens and small layout/props changes\n" +
          "   c) Call validateSpec with spec_json\n" +
          "   d) If valid and score >= 0.8, call savePreviewVersion and return previewUrl.\n\n" +
          "Token conventions:\n" +
          "- Use dot-paths in setDesignToken, e.g. 'theme.color.primary', 'theme.color.background', 'theme.radius.md', 'theme.shadow.card', 'theme.typography.fontFamily', 'theme.spacing.base'.\n" +
          "- Keep changes minimal and reversible.\n",
      },
      { role: "system", content: `Mode: ${mode}, Phase: ${phase}, platformType: ${platformType}` },
      {
        role: "system",
        content:
          "Tools:\n" +
          "- Python UI/UX Pro Max tools: generate design systems and search design database\n" +
          "- searchDesignKBLocal: keyword-based fallback for local HTML UI/UX assets\n" +
          "- getCurrentSpec/applySpecPatch/validateSpec/savePreviewVersion: deterministic spec editing pipeline\n",
      },
    ];
  },
  model: glm47Model(),
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
  tools: {
    searchDesignKBLocal,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
  },
});
