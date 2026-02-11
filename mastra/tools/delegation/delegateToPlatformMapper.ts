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
    previewUrl: z.string().optional(),
    previewVersionId: z.string().optional(),
    interfaceId: z.string().optional(),
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
        maxSteps: 8, // Keep at 8 for autonomous execution (per agent_research.md)
        toolChoice: "auto",
        requestContext: context?.requestContext,
        memory: {
          resource: userId,
          thread: threadId,
        },
        onStepFinish: ({ toolCalls, finishReason }) => {
          // Log each step for debugging without blocking autonomous flow
          // Use safe property access to handle different ToolCall shapes across SDK versions
          const toolNames = (toolCalls ?? []).map((tc: Record<string, unknown>) => {
            // AI SDK v5 uses 'toolName', some versions may use 'name'
            return (tc.toolName ?? tc.name ?? 'unknown') as string;
          });
          console.log('[delegateToPlatformMapper] Step completed:', {
            tools: toolNames,
            reason: finishReason,
          });
        },
      });

      // Extract structured workflow results from sub-agent tool calls
      // The sub-agent calls runGeneratePreviewWorkflow which returns previewUrl/previewVersionId
      // but result.text only contains prose — we need the actual tool output
      let previewUrl: string | undefined;
      let previewVersionId: string | undefined;
      let interfaceId: string | undefined;

      if (result.toolResults && Array.isArray(result.toolResults)) {
        for (const tr of result.toolResults) {
          const toolResult = tr as any;
          if (toolResult.toolName === 'runGeneratePreviewWorkflow' && toolResult.result?.success) {
            previewUrl = toolResult.result.previewUrl;
            previewVersionId = toolResult.result.previewVersionId;
            interfaceId = toolResult.result.interfaceId;
          }
        }
      }

      // Also check steps array (Mastra v1 may use this structure)
      if (!previewUrl && result.steps && Array.isArray(result.steps)) {
        for (const step of result.steps) {
          const stepData = step as any;
          const toolResults = stepData.toolResults;
          if (Array.isArray(toolResults)) {
            for (const tr of toolResults) {
              const toolResult = tr as any;
              if (toolResult.toolName === 'runGeneratePreviewWorkflow' && toolResult.result?.success) {
                previewUrl = toolResult.result.previewUrl;
                previewVersionId = toolResult.result.previewVersionId;
                interfaceId = toolResult.result.interfaceId;
              }
            }
          }
        }
      }

      return {
        success: true,
        response: result.text || "Platform mapping completed.",
        previewUrl,
        previewVersionId,
        interfaceId,
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
