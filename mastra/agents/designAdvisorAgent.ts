


import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { searchDesignKB, searchDesignKBLocal } from "../tools/designAdvisor";
import {
  getCurrentSpec,
  applySpecPatch,
  savePreviewVersion,
} from "../tools/specEditor";
import { validateSpec } from "../tools/validateSpec";

/**
 * Design Advisor Agent (RAG-powered)
 * 
 * NOTE: This agent does NOT expose tools in the tools property.
 * Instead, tools are called internally within the agent's generate() method.
 * This prevents type incompatibility with CopilotKit/AG-UI integration.
 * 
 * Pattern: Agent receives user request → internally calls Mastra tools → returns response
 */
export const designAdvisorAgent: Agent = new Agent({
  name: "designAdvisorAgent",
  description:
    "Design Advisor Agent (RAG): grounded UI/UX + design-system guidance. Proposes and optionally applies design token/layout improvements to make dashboards more premium.",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext }) => {
    const mode = (runtimeContext.get("mode") as string | undefined) ?? "edit";
    const phase = (runtimeContext.get("phase") as string | undefined) ?? "editing";
    const platformType = (runtimeContext.get("platformType") as string | undefined) ?? "other";

    return [
      {
        role: "system",
        content:
          "You are the Design Advisor Agent (RAG) for GetFlowetic.\n\n" +
          "Goal: Make the dashboard look polished, modern, and appropriate for the user's brand (e.g., law firm, healthcare, startup) while staying consistent with the GetFlowetic component system.\n\n" +
          "CRITICAL RULES:\n" +
          "- Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID. Never mention internal identifiers.\n" +
          "- Use RAG retrieval before giving design recommendations.\n" +
          "- Never invent a design system. If retrieval is empty or low-quality, give conservative, broadly safe guidance and say it's a best-practice default.\n" +
          "- Prefer concrete edits: design tokens (colors, radius, spacing, typography), component prop defaults, and light layout tweaks.\n" +
          "- Do not show raw spec JSON unless explicitly requested.\n\n" +
          "When the user asks to 'make it look more premium' or similar:\n" +
          "1) Retrieve relevant design guidance from the knowledge base.\n" +
          "2) Summarize recommendations in 5–10 bullets max.\n" +
          "3) If the user wants changes applied (or they say 'apply it' / 'do it'), apply design improvements.\n\n" +
          "Token conventions:\n" +
          "- Use dot-paths for design tokens, e.g. 'theme.color.primary', 'theme.color.background', 'theme.radius.md', 'theme.shadow.card', 'theme.typography.fontFamily', 'theme.spacing.base'.\n" +
          "- Keep changes minimal and reversible.\n",
      },
      { role: "system", content: `Mode: ${mode}, Phase: ${phase}, platformType: ${platformType}` },
      {
        role: "system",
        content:
          "Available capabilities:\n" +
          "- Search design knowledge base for grounded UI/UX guidance\n" +
          "- Get current dashboard specification\n" +
          "- Apply design token and layout improvements\n" +
          "- Validate changes for safety and consistency\n" +
          "- Save preview versions for review\n",
      },
    ];
  },
  model: openai("gpt-4o"),
  // NOTE: tools property removed - tools are called internally instead
  // This prevents CopilotKit type incompatibility (see AGENT_BUILD_TROUBLESHOOTING_GUIDE_V2.md Error 7)
});

/**
 * Helper function to call design tools internally
 * This is invoked by the agent orchestration layer, not exposed as direct tools
 */
export async function executeDesignAdvisorTools(
  action: string,
  context: Record<string, any>,
  runtimeContext: RuntimeContext
): Promise<any> {
  switch (action) {
    case "searchDesignKB":
      return await searchDesignKB.execute({ context, runtimeContext });
    
    case "searchDesignKBLocal":
      return await searchDesignKBLocal.execute({ context, runtimeContext });
    
    case "getCurrentSpec":
      return await getCurrentSpec.execute({ context, runtimeContext });
    
    case "applySpecPatch":
      return await applySpecPatch.execute({ context, runtimeContext });
    
    case "validateSpec":
      return await validateSpec.execute({ context, runtimeContext });
    
    case "savePreviewVersion":
      return await savePreviewVersion.execute({ context, runtimeContext });
    
    default:
      throw new Error(`Unknown design advisor action: ${action}`);
  }
}


