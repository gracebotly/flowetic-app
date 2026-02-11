
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { designAdvisorAgent } from "../../agents/designAdvisorAgent";

export const delegateToDesignAdvisor = createTool({
  id: "delegateToDesignAdvisor",
  description: `Delegate design system and style decisions to the Design Advisor specialist.

USE THIS TOOL WHEN:
- User asks about design direction, colors, typography, or visual style
- Phase is "style" and you need expert design recommendations
- User asks for "premium", "minimal", "bold", "corporate" styling
- You need data-driven style recommendations from the design database

The Design Advisor has access to: getStyleRecommendations, getTypographyRecommendations,
getChartRecommendations, getProductRecommendations, getUXGuidelines, and recommendStyleKeywords.

The advisor MUST call these tools before providing recommendations - never from memory.`,

  inputSchema: z.object({
    task: z.string().min(1).describe(
      "Design question or task. Examples: " +
      "'Recommend a premium design system for a law firm analytics dashboard', " +
      "'What typography works for a bold, modern SaaS dashboard', " +
      "'Suggest color palettes suitable for healthcare monitoring'"
    ),
    additionalContext: z.string().optional().describe(
      "Industry, audience, existing preferences, platform type"
    ),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    response: z.string(),
    error: z.string().optional(),
  }),

  execute: async (input, context) => {
    try {
      const userId = context?.requestContext?.get('userId') as string;
      const threadId = context?.requestContext?.get('threadId') as string;

      if (!userId || !threadId) {
        return {
          success: false,
          response: "",
          error: "Missing userId or threadId in RequestContext",
        };
      }

      const journeyThreadId = context?.requestContext?.get('journeyThreadId') as string;
      const prompt = [
        input.task,
        input.additionalContext ? `\nAdditional context: ${input.additionalContext}` : "",
        journeyThreadId ? `\nIMPORTANT - When calling getJourneySession, use threadId: "${journeyThreadId}" (not a display name)` : "",
      ].filter(Boolean).join("\n");

      // Debug logging for context propagation
      if (process.env.DEBUG_CONTEXT === 'true') {
        const contextKeys = ['tenantId', 'userId', 'threadId', 'sourceId',
          'interfaceId', 'supabaseAccessToken', 'platformType', 'phase'];
        const contextSnapshot: Record<string, string> = {};
        for (const key of contextKeys) {
          const val = context?.requestContext?.get(key);
          contextSnapshot[key] = val ? `${String(val).substring(0, 8)}...` : 'MISSING';
        }
        console.log('[delegateToDesignAdvisor] Context propagation:', contextSnapshot);
      }

      const result = await designAdvisorAgent.generate(prompt, {
        maxSteps: 5,
        toolChoice: "required",  // Force tool usage - agent MUST call tools
        requestContext: context?.requestContext,
        memory: {
          resource: userId,
          thread: threadId,
        },
      });

      return {
        success: true,
        response: result.text || "Design recommendations generated.",
      };
    } catch (error: any) {
      console.error("[delegateToDesignAdvisor] Error:", error.message);
      return {
        success: false,
        response: "",
        error: `Design advisor failed: ${error.message}`,
      };
    }
  },
});
