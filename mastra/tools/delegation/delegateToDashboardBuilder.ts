
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

      // Debug logging for context propagation
      if (process.env.DEBUG_CONTEXT === 'true') {
        const contextKeys = ['tenantId', 'userId', 'threadId', 'sourceId',
          'interfaceId', 'supabaseAccessToken', 'platformType', 'phase'];
        const contextSnapshot: Record<string, string> = {};
        for (const key of contextKeys) {
          const val = context?.requestContext?.get(key);
          contextSnapshot[key] = val ? `${String(val).substring(0, 8)}...` : 'MISSING';
        }
        console.log('[delegateToDashboardBuilder] Context propagation:', contextSnapshot);
      }

      const result = await dashboardBuilderAgent.generate(prompt, {
        maxSteps: 8,
        toolChoice: "auto",
        requestContext: context?.requestContext,
        memory: {
          resource: userId,
          thread: threadId,
        },
      });

      // ── BUG 1 FIX: Detect sub-agent tool failures instead of blindly returning success ──
      // The sub-agent generates optimistic text ("I've applied the changes...")
      // even when ALL applySpecPatch calls failed validation. Check actual tool results.
      let hasSuccessfulPatch = false;
      const patchErrors: string[] = [];

      if (result.steps && Array.isArray(result.steps)) {
        for (const step of result.steps) {
          const stepData = step as any;
          if (Array.isArray(stepData.toolResults)) {
            for (const tr of stepData.toolResults) {
              const toolResult = tr as any;
              const toolName = toolResult.toolName ?? toolResult.payload?.toolName;
              const toolOutput = toolResult.output ?? toolResult.payload?.result ?? toolResult.payload?.output;

              if (toolName === 'applySpecPatch') {
                if (toolOutput?.applied && Array.isArray(toolOutput.applied) && toolOutput.applied.length > 0) {
                  hasSuccessfulPatch = true;
                } else if (toolOutput?.error || toolResult.isError) {
                  patchErrors.push(String(toolOutput?.error || toolResult.error || 'Unknown patch error'));
                }
              }
              if (toolName === 'savePreviewVersion') {
                if (toolOutput?.previewUrl || toolOutput?.versionId) {
                  hasSuccessfulPatch = true;
                }
              }
            }
          }
          // Also check toolCalls for validation failures (AI SDK v5 surfaces these)
          if (Array.isArray(stepData.toolCalls)) {
            for (const tc of stepData.toolCalls) {
              const call = tc as any;
              if ((call.toolName === 'applySpecPatch') && call.error) {
                patchErrors.push(String(call.error));
              }
            }
          }
        }
      }

      // ── Fallback: scan top-level toolResults (AI SDK v5 may surface results here) ──
      if (!hasSuccessfulPatch && patchErrors.length === 0) {
        const topLevelResults = (result as any).toolResults;
        if (Array.isArray(topLevelResults)) {
          for (const tr of topLevelResults) {
            const toolResult = tr as any;
            const toolName = toolResult.toolName ?? toolResult.name;
            const toolOutput = toolResult.output ?? toolResult.result;

            if (toolName === 'applySpecPatch') {
              if (toolOutput?.applied && Array.isArray(toolOutput.applied) && toolOutput.applied.length > 0) {
                hasSuccessfulPatch = true;
              } else {
                patchErrors.push(String(toolOutput?.error || toolResult.error || 'applySpecPatch returned no applied operations'));
              }
            }
            if (toolName === 'savePreviewVersion') {
              if (toolOutput?.previewUrl || toolOutput?.versionId) {
                hasSuccessfulPatch = true;
              }
            }
          }
        }
      }

      // If the task was an edit request but no patch succeeded, report failure
      const isEditTask = /edit|change|modify|update|add|remove|darker|lighter|color|font|layout|chart|pie|bar/i.test(input.task);
      if (isEditTask && !hasSuccessfulPatch) {
        const errorDetail = patchErrors.length > 0
          ? `Patch errors: ${patchErrors.slice(0, 3).join('; ')}.`
          : 'No applySpecPatch calls succeeded (the sub-agent may not have called the tool, or all calls failed validation).';
        console.warn('[delegateToDashboardBuilder] Edit task failed - no successful patches:', patchErrors);
        return {
          success: false,
          response: "",
          error: `Dashboard edit failed. ${errorDetail} The agent should call getCurrentSpec first to load the current spec, then apply small incremental patches (≤5 operations each).`,
        };
      }

      return {
        success: hasSuccessfulPatch || !isEditTask,
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
