import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { platformMappingMaster } from "../../agents/platformMappingMaster";

export const delegateToPlatformMapper = createTool({
  id: "delegateToPlatformMapper",
  description: `Delegate complex platform analysis and preview generation to the Platform Mapping specialist.

USE THIS TOOL WHEN:
- User wants to generate a dashboard preview
- You need to analyze workflow/platform data schema
- You need to inspect event samples from the connected platform
- You need to trigger preview generation (runGeneratePreviewWorkflow)
- You need to check schema readiness or trigger data backfill
- Phase is "build_preview" and user wants their dashboard generated

The Platform Mapping specialist has access to: analyzeSchema, generateMapping,
getSchemaSummary, runGeneratePreviewWorkflow, getJourneySession, setSchemaReady,
appendThreadEvent, getRecentEventSamples, recommendTemplates, proposeMapping,
saveMapping, connectionBackfillWorkflow, getEventStats, getEventSamples,
validatePreviewReadiness, and platform-specific skills.

DO NOT try to generate previews yourself — always delegate to this specialist.`,

  inputSchema: z.object({
    task: z.string().min(1).describe(
      "Clear description of what needs to be done. Examples: " +
      "'Analyze the n8n workflow data and generate a dashboard preview', " +
      "'Check schema readiness and trigger data backfill if needed', " +
      "'Generate preview with outcome=dashboard and style=minimal-pro'"
    ),
    additionalContext: z.string().optional().describe(
      "Any extra context from the conversation: selected outcome, style, entities, etc."
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

      // Also pass journeyThreadId if available (the client journey thread for journey_sessions lookups)
      const journeyThreadId = context?.requestContext?.get('journeyThreadId') as string;
      
      const enhancedPrompt = [
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
        console.log('[delegateToPlatformMapper] Context propagation:', contextSnapshot);
      }

      const result = await platformMappingMaster.generate(enhancedPrompt, {
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
        response: result.text || "Platform mapping completed.",
      };
    } catch (error: any) {
      console.error("[delegateToPlatformMapper] Error:", error.message);
      return {
        success: false,
        response: "",
        error: `Platform mapping failed: ${error.message}`,
      };
    }
  },
});
