import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { platformMappingMaster } from "../../agents/platformMappingMaster";
import { advancePhase } from "../journey/advancePhase";
import { todoComplete } from "../todo";

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
        // Pass parent tools that sub-agent needs but doesn't have in its config
        toolsets: {
          parentTools: {
            advancePhase,
            todoComplete,
          },
        },
        memory: {
          resource: userId,
          thread: threadId,
        },
        onStepFinish: ({ toolCalls, finishReason }) => {
          // Log each step for debugging without blocking autonomous flow
          const toolNames = (toolCalls ?? []).map((tc) => {
            const call = tc as any;
            // AI SDK v5: call.toolName is canonical
            // Mastra Agent Network format: { type: "tool-call", payload: { toolName: "..." } }
            const name = call.toolName ?? call.payload?.toolName ?? 'unknown';
            if (name === 'unknown') {
              console.log('[delegateToPlatformMapper] Unknown tool call structure:', JSON.stringify(call, null, 2).substring(0, 500));
            }
            return String(name);
          });
          console.log('[delegateToPlatformMapper] Step completed:', {
            tools: toolNames,
            reason: finishReason,
          });
        },
      });

      // === EXTRACTION: Try multiple paths to find previewUrl from sub-agent results ===

      // DEBUG: Log available result keys so we can see what the sub-agent actually returns
      console.log('[delegateToPlatformMapper] Result keys:', Object.keys(result));
      console.log('[delegateToPlatformMapper] toolResults type:', typeof result.toolResults, Array.isArray(result.toolResults) ? `(${result.toolResults.length} items)` : '');
      console.log('[delegateToPlatformMapper] steps type:', typeof result.steps, Array.isArray(result.steps) ? `(${result.steps.length} items)` : '');

      let previewUrl: string | undefined;
      let previewVersionId: string | undefined;
      let interfaceId: string | undefined;

      // Path 1: result.toolResults (top-level tool results)
      // Handle BOTH standard AI SDK v5 format AND Mastra agent network format
      if (result.toolResults && Array.isArray(result.toolResults)) {
        for (const tr of result.toolResults) {
          const toolResult = tr as any;

          // Mastra agent network format: { type: 'tool-result', from: 'AGENT', payload: { toolName, result } }
          // Standard AI SDK v5 format: { toolName, output }
          const isMastraNetworkFormat = toolResult.type === 'tool-result' && toolResult.payload;

          const toolName = isMastraNetworkFormat
            ? toolResult.payload?.toolName
            : toolResult.toolName;
          const toolOutput = isMastraNetworkFormat
            ? (toolResult.payload?.result ?? toolResult.payload?.output)
            : toolResult.output;

          console.log('[delegateToPlatformMapper] toolResult:', {
            format: isMastraNetworkFormat ? 'mastra-network' : 'ai-sdk-v5',
            toolName,
            hasOutput: !!toolOutput,
            keys: Object.keys(toolResult),
          });

          if (toolName === 'runGeneratePreviewWorkflow' && toolOutput?.success) {
            previewUrl = toolOutput.previewUrl;
            previewVersionId = toolOutput.previewVersionId;
            interfaceId = toolOutput.interfaceId;
            console.log('[delegateToPlatformMapper] Found preview URL:', previewUrl);
          }
          // Also check persistPreviewVersion which is the inner tool that actually has the URL
          if (toolName === 'persistPreviewVersion' && (toolOutput?.previewUrl || toolOutput?.interfaceId)) {
            previewUrl = previewUrl || toolOutput.previewUrl;
            previewVersionId = previewVersionId || toolOutput.previewVersionId || toolOutput.versionId;
            interfaceId = interfaceId || toolOutput.interfaceId;
          }
        }
      }

      // Path 2: result.steps[].toolResults (step-level tool results)
      if (!previewUrl && result.steps && Array.isArray(result.steps)) {
        for (const step of result.steps) {
          const stepData = step as any;
          const toolResults = stepData.toolResults;
          if (Array.isArray(toolResults)) {
            for (const tr of toolResults) {
              const toolResult = tr as any;

              // Handle both Mastra network format and AI SDK v5 format
              const isMastraNetworkFormat = toolResult.type === 'tool-result' && toolResult.payload;
              const toolName = isMastraNetworkFormat
                ? toolResult.payload?.toolName
                : toolResult.toolName;
              const toolOutput = isMastraNetworkFormat
                ? (toolResult.payload?.result ?? toolResult.payload?.output)
                : toolResult.output;

              if (toolName === 'runGeneratePreviewWorkflow' && toolOutput?.success) {
                previewUrl = toolOutput.previewUrl;
                previewVersionId = toolOutput.previewVersionId;
                interfaceId = toolOutput.interfaceId;
              }
              if (toolName === 'persistPreviewVersion' && (toolOutput?.previewUrl || toolOutput?.interfaceId)) {
                previewUrl = previewUrl || toolOutput.previewUrl;
                previewVersionId = previewVersionId || toolOutput.previewVersionId || toolOutput.versionId;
                interfaceId = interfaceId || toolOutput.interfaceId;
              }
            }
          }
        }
      }

      // Path 3: Parse previewUrl from result.text as last resort
      if (!previewUrl && result.text) {
        const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
        const urlMatch = result.text.match(new RegExp(`/preview/(${UUID_PATTERN})/(${UUID_PATTERN})`, 'i'));
        if (urlMatch) {
          previewUrl = urlMatch[0];
          interfaceId = urlMatch[1];
          previewVersionId = urlMatch[2];
          console.log('[delegateToPlatformMapper] Extracted previewUrl from text:', previewUrl);
        }
      }

      // Path 4 (safety net): Extract interfaceId from previewUrl if we have URL but missing interfaceId
      if (previewUrl && !interfaceId) {
        const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
        const urlParts = previewUrl.match(new RegExp(`/preview/(${UUID_PATTERN})/(${UUID_PATTERN})`, 'i'));
        if (urlParts) {
          interfaceId = urlParts[1];
          previewVersionId = previewVersionId || urlParts[2];
          console.log('[delegateToPlatformMapper] Extracted interfaceId from previewUrl:', interfaceId);
        }
      }

      // Log successful extraction for debugging
      console.log('[delegateToPlatformMapper] Returning result:', {
        success: true,
        hasPreviewUrl: !!previewUrl,
        previewUrl: previewUrl ? `${previewUrl.substring(0, 50)}...` : undefined,
        interfaceId,
        previewVersionId,
      });
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
