

import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
// import { RequestContext } from "@mastra/core/request-context"; // Removed - invalid import
import { searchDesignKB, searchDesignKBLocal } from "../tools/designAdvisor";
import {
  getCurrentSpec,
  applySpecPatch,
  savePreviewVersion,
} from "../tools/specEditor";
import { validateSpec } from "../tools/validateSpec";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { getStyleBundles } from "../tools/design";

export const designAdvisorAgent = new Agent({
  id: "design-advisor-agent",
  name: "designAdvisorAgent",
  description:
    "Design Advisor Agent (RAG): grounded UI/UX + design-system guidance. Proposes and optionally applies design token/layout improvements to make dashboards more premium.",
  instructions: async ({ runtimeContext, mastra }: { runtimeContext: any; mastra?: any }) => {
    const mode = (runtimeContext.get ? runtimeContext.get("mode") : undefined) ?? "edit";
    const phase = (runtimeContext.get ? runtimeContext.get("phase") : undefined) ?? "editing";
    const platformType = (runtimeContext.get ? runtimeContext.get("platformType") : undefined) ?? "make";

    return [
      {
        role: "system",
        content:
          "You are the Design Advisor Agent (RAG) for GetFlowetic.\n\n" +
          "Goal: Make the dashboard look polished, modern, and appropriate for the user's brand (e.g., law firm, healthcare, startup) while staying consistent with the GetFlowetic component system.\n\n" +
          "CRITICAL RULES:\n" +
          "- Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID. Never mention internal identifiers.\n" +
          "- Use RAG retrieval before giving design recommendations: call searchDesignKB with the user's style request.\n" +
          "If searchDesignKB fails or returns empty context, fall back to searchDesignKBLocal (keyword-based) and proceed with conservative recommendations.\n" +
          "- Never invent a design system. If retrieval is empty or low-quality, give conservative, broadly safe guidance and say it's a best-practice default.\n" +
          "- Prefer concrete edits: design tokens (colors, radius, spacing, typography), component prop defaults, and light layout tweaks.\n" +
          "- Do not show raw spec JSON unless explicitly requested.\n\n" +
          "When the user asks to 'make it look more premium' or similar:\n" +
          "1) Call searchDesignKB to retrieve relevant guidance.\n" +
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
          "- searchDesignKB: RAG search for grounded UI/UX guidance\n" +
          "- getCurrentSpec/applySpecPatch/validateSpec/savePreviewVersion: deterministic spec editing pipeline\n",
      },
    ];
  },
  model: openai("gpt-4o"),
  tools: {
    searchDesignKB,
    searchDesignKBLocal,
    getStyleBundles,
    getCurrentSpec,
    applySpecPatch,
    validateSpec,
    savePreviewVersion,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
  },
});
