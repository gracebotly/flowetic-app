
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { designAdvisorAgent } from "../../agents/designAdvisorAgent";
import { createAuthenticatedClient } from "../../lib/supabase";
import { buildDesignTokens } from "../uiux/mapCSVToTokens";

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

      // ─── Persist design tokens from advisor tool results ──────────────
      // Without this, style regeneration via design advisor is cosmetic-only.
      // The agent calls getColorRecommendations, getStyleRecommendations, etc.
      // but the results were never written to journey_sessions.design_tokens.
      // Pattern copied from runDesignSystemWorkflow.ts which persists correctly.
      const tenantId = context?.requestContext?.get('tenantId') as string;
      const supabaseToken = context?.requestContext?.get('supabaseAccessToken') as string;

      if (journeyThreadId && tenantId && supabaseToken) {
        try {
          // Extract tool call results from the agent response
          const toolResults = (result as any).toolResults || (result as any).steps?.flatMap((s: any) => s.toolResults || []) || [];

          const colorResult = toolResults.find((t: any) => t.toolName === 'getColorRecommendations');
          const styleResult = toolResults.find((t: any) => t.toolName === 'getStyleRecommendations');
          const typoResult = toolResults.find((t: any) => t.toolName === 'getTypographyRecommendations');

          // Only persist if we got at least color data back
          const colorRecs = colorResult?.result?.recommendations || colorResult?.result?.output?.recommendations;
          if (colorRecs && colorRecs.length > 0) {
            const topColor = colorRecs[0];
            const topStyle = (styleResult?.result?.recommendations || styleResult?.result?.output?.recommendations || [])[0] || {};
            const topTypo = (typoResult?.result?.recommendations || typoResult?.result?.output?.recommendations || [])[0] || {};

            const normalizedTokens = buildDesignTokens({
              colorRow: topColor,
              typographyRow: topTypo,
              styleRow: topStyle,
            });

            const supabase = createAuthenticatedClient(supabaseToken);
            const { error: persistErr } = await supabase
              .from('journey_sessions')
              .update({
                design_tokens: normalizedTokens,
                selected_style_bundle_id: 'custom',
                style_confirmed: false, // Reset confirmation — user needs to approve new style
                updated_at: new Date().toISOString(),
              })
              .eq('thread_id', journeyThreadId)
              .eq('tenant_id', tenantId);

            if (persistErr) {
              console.error('[delegateToDesignAdvisor] Failed to persist design_tokens:', persistErr.message);
            } else {
              // Update RequestContext for downstream tools in this request cycle
              if (context?.requestContext) {
                context.requestContext.set('designTokens', JSON.stringify(normalizedTokens));
                context.requestContext.set('designSystemGenerated', 'true');
              }
              console.log('[delegateToDesignAdvisor] ✅ Persisted new design_tokens:', {
                styleName: normalizedTokens.style?.name,
                primary: normalizedTokens.colors?.primary,
                secondary: normalizedTokens.colors?.secondary,
                accent: normalizedTokens.colors?.accent,
                heading: normalizedTokens.fonts?.heading,
              });
            }
          } else {
            console.warn('[delegateToDesignAdvisor] No color recommendations found in tool results. Skipping token persistence.');
          }
        } catch (persistErr) {
          // Non-fatal: the text response still goes to the user
          console.warn('[delegateToDesignAdvisor] Non-fatal persist error:', persistErr);
        }
      }

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
