
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { dashboardBuilderAgent } from "../../agents/dashboardBuilderAgent";

export const delegateToDashboardBuilder = createTool({
  id: "delegateToDashboardBuilder",
  description: `Delegate dashboard spec editing and refinement to the Dashboard Builder specialist.

USE THIS TOOL WHEN:
- User wants to edit/modify their dashboard (change colors, add/remove components, etc.)
- Phase is "interactive_edit"
- User says "make it darker", "add a pie chart", "change the title", etc.
- You need to load, patch, validate, or save a dashboard spec
- User wants to reorder components or apply interactive edits

The Dashboard Builder has access to: getCurrentSpec, applySpecPatch, validateSpec,
savePreviewVersion, applyInteractiveEdits, reorderComponents, getEventSamples,
and the UI/UX Pro Max skill for design-aware editing.

DO NOT try to edit dashboard specs yourself — always delegate to this specialist.`,

  inputSchema: z.object({
    task: z.string().min(1).describe(
      "Clear description of the edit. Examples: " +
      "'Make the dashboard darker with a navy background', " +
      "'Add a pie chart showing conversion rates', " +
      "'Change the primary color to blue and increase spacing'"
    ),
    additionalContext: z.string().optional().describe(
      "Any extra context: current interfaceId, user preferences, style direction"
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

      const result = await dashboardBuilderAgent.generate(prompt, {
        maxSteps: 8,
        toolChoice: "auto",
        requestContext: context?.requestContext,
        memory: {
          resource: userId,
          thread: threadId,
        },
      });

      return {
        success: true,
        response: result.text || "Dashboard edits applied.",
      };
    } catch (error: any) {
      console.error("[delegateToDashboardBuilder] Error:", error.message);
      return {
        success: false,
        response: "",
        error: `Dashboard editing failed: ${error.message}`,
      };
    }
  },
});

