

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
- You need to search the design database for specific patterns
- You need to generate a complete design token system

The Design Advisor has access to: searchDesignDatabase (BM25 RAG over design knowledge),
generateDesignSystem (complete design token generation), recommendStyleKeywords,
and the UI/UX Pro Max skill.

Prefer this specialist for any design-related decisions over generic recommendations.`,

  inputSchema: z.object({
    task: z.string().min(1).describe(
      "Design question or task. Examples: " +
      "'Recommend a premium design system for a law firm analytics dashboard', " +
      "'Generate design tokens for a bold, modern SaaS dashboard', " +
      "'Search for color palettes suitable for healthcare monitoring'"
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

      const result = await designAdvisorAgent.generate(prompt, {
        maxSteps: 6,
        toolChoice: "auto",
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


