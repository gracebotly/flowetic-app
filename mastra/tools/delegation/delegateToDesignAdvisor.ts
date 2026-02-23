
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { mastra } from "../../index";
import { createAuthenticatedClient } from "../../lib/supabase";

/**
 * delegateToDesignAdvisor — Regenerate design system with variety.
 *
 * ARCHITECTURE FIX (Failures 2, 3, 4):
 * Previously this tool spawned designAdvisorAgent as a sub-agent and tried
 * to extract tool results from agent.generate(). Mastra's agent.generate()
 * returns { text: string } — internal tool call results are opaque.
 * This meant:
 *   - F2: Token persistence never fired (toolResults always empty)
 *   - F3: Identical results (same deterministic workflow, no variety params)
 *   - F4: Old tokens stayed in DB (nothing ever overwrote them)
 *
 * NEW APPROACH: Call designSystemWorkflow directly with variety parameters.
 * - userFeedback: from the user's task description → shifts BM25 ranking
 * - excludeStyleNames: from previous design_tokens in DB → ensures different results
 * - Persistence: handled by runDesignSystemWorkflow pattern (direct DB write)
 *
 * The designAdvisorAgent is still used internally by the workflow's synthesize
 * step for LLM-based selection (toolChoice: "none", maxSteps: 1).
 */
export const delegateToDesignAdvisor = createTool({
  id: "delegateToDesignAdvisor",
  description: `Regenerate a different design system based on user feedback.

USE THIS TOOL WHEN:
- User rejected the current design and wants something different
- User asks for specific style changes: "darker", "more premium", "minimal", "navy blue"
- User says "show different styles" or "try again"
- You need to regenerate with DIFFERENT results than the current design

This tool calls the design system workflow with the user's feedback to produce
a NEW design that is different from the current one. It automatically excludes
previously shown styles and uses the user's preferences to shift the search.

DO NOT use this for the initial design generation — that happens automatically.
Use this only for regeneration/alternatives.`,

  inputSchema: z.object({
    task: z.string().min(1).describe(
      "User's style feedback or preference. Examples: " +
      "'darker theme with navy blue', " +
      "'more premium and professional', " +
      "'something minimal and clean', " +
      "'totally different style'"
    ),
    additionalContext: z.string().optional().describe(
      "Industry, audience, existing preferences, platform type"
    ),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    response: z.string(),
    designSystem: z.any().optional(),
    persisted: z.boolean().optional(),
    error: z.string().optional(),
  }),

  execute: async (input, context) => {
    try {
      const tenantId = context?.requestContext?.get('tenantId') as string;
      const userId = context?.requestContext?.get('userId') as string;
      const journeyThreadId = context?.requestContext?.get('journeyThreadId') as string;
      const supabaseToken = context?.requestContext?.get('supabaseAccessToken') as string;
      const workflowName = context?.requestContext?.get('workflowName') as string || 'Dashboard';
      const platformType = context?.requestContext?.get('platformType') as string || 'other';
      const selectedOutcome = context?.requestContext?.get('selectedOutcome') as string || 'dashboard';
      const selectedEntities = context?.requestContext?.get('selectedEntities') as string || '';

      if (!tenantId || !userId) {
        return {
          success: false,
          response: "",
          error: "Missing tenantId or userId in RequestContext",
        };
      }

      // Read current design_tokens from DB to build exclusion list
      const excludeStyleNames: string[] = [];
      const excludeColorHexValues: string[] = [];
      if (journeyThreadId && supabaseToken) {
        try {
          const supabase = createAuthenticatedClient(supabaseToken);
          const { data: session } = await supabase
            .from('journey_sessions')
            .select('design_tokens')
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (session?.design_tokens) {
            const previousDesignTokens = session.design_tokens as any;
            const currentStyleName = previousDesignTokens?.style?.name;
            const currentPaletteName = previousDesignTokens?.colors?.paletteName;
            // Extract previous primary color for hex-level exclusion
            const previousPrimaryHex = previousDesignTokens?.colors?.primary;
            if (currentStyleName) excludeStyleNames.push(currentStyleName);
            if (currentPaletteName) excludeStyleNames.push(currentPaletteName);
            if (previousPrimaryHex) excludeColorHexValues.push(previousPrimaryHex);
          }
        } catch (readErr) {
          console.warn('[delegateToDesignAdvisor] Non-fatal: failed to read current tokens for exclusion:', readErr);
        }
      }

      console.log('[delegateToDesignAdvisor] Regenerating design system:', {
        userFeedback: input.task.substring(0, 80),
        excluding: excludeStyleNames,
        excludeColorHexValues,
        workflowName,
        platformType,
      });

      // Call the workflow directly — same pipeline as runDesignSystemWorkflow
      // but with variety parameters that ensure different results
      const workflow = mastra.getWorkflow("designSystemWorkflow");

      if (!workflow) {
        console.error("[delegateToDesignAdvisor] designSystemWorkflow not found");
        return {
          success: false,
          response: "",
          error: "Design system workflow not available",
        };
      }

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          workflowName,
          platformType,
          selectedOutcome,
          selectedEntities,
          tenantId,
          userId,
          // Variety parameters: user feedback shifts BM25 ranking,
          // exclusions filter out previously shown styles/palettes
          userFeedback: [input.task, input.additionalContext].filter(Boolean).join(". "),
          excludeStyleNames: excludeStyleNames.length > 0 ? excludeStyleNames : undefined,
          excludeColorHexValues: excludeColorHexValues.length > 0 ? excludeColorHexValues : undefined,
        },
        requestContext: context?.requestContext,
      });

      if (result.status !== "success" || !result.result) {
        return {
          success: false,
          response: "",
          error: `Design workflow finished with status: ${result.status}`,
        };
      }

      const data = result.result as any;
      const designSystem = data.designSystem;

      if (!designSystem) {
        return { success: false, response: "", error: "Workflow returned no design system" };
      }

      // Normalize tokens (same pattern as runDesignSystemWorkflow.ts)
      const normalizedTokens = {
        ...designSystem,
        fonts: {
          heading: designSystem.fonts?.heading
            || (designSystem.typography?.headingFont
              ? designSystem.typography.headingFont + (designSystem.typography.headingFont.includes(',') ? '' : ', sans-serif')
              : 'Inter, sans-serif'),
          body: designSystem.fonts?.body
            || (designSystem.typography?.bodyFont
              ? designSystem.typography.bodyFont + (designSystem.typography.bodyFont.includes(',') ? '' : ', sans-serif')
              : 'Inter, sans-serif'),
          googleFontsUrl: designSystem.fonts?.googleFontsUrl || undefined,
          cssImport: designSystem.fonts?.cssImport || undefined,
        },
        colors: {
          ...designSystem.colors,
          success: designSystem.colors?.success || '#10B981',
          warning: designSystem.colors?.warning || '#F59E0B',
          error: designSystem.colors?.error || '#EF4444',
          text: designSystem.colors?.text || '#0F172A',
        },
        spacing: designSystem.spacing || { unit: 8 },
        radius: designSystem.radius ?? 8,
        shadow: designSystem.shadow || 'soft',
      };

      // Persist to DB — this is what the old sub-agent approach failed to do
      let persisted = false;
      if (journeyThreadId && supabaseToken && tenantId) {
        try {
          const supabase = createAuthenticatedClient(supabaseToken);
          const { error: persistErr } = await supabase
            .from('journey_sessions')
            .update({
              design_tokens: normalizedTokens,
              selected_style_bundle_id: 'custom',
              style_confirmed: false, // Reset — user must approve new design
              updated_at: new Date().toISOString(),
            })
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', tenantId);

          if (persistErr) {
            console.error('[delegateToDesignAdvisor] Failed to persist design_tokens:', persistErr.message);
          } else {
            persisted = true;
            // Update RequestContext for downstream tools in this request cycle
            if (context?.requestContext) {
              context.requestContext.set('designTokens', JSON.stringify(normalizedTokens));
              context.requestContext.set('designSystemGenerated', 'true');
            }
            console.log('[delegateToDesignAdvisor] ✅ Persisted new design_tokens:', {
              styleName: normalizedTokens.style?.name,
              primary: normalizedTokens.colors?.primary,
              heading: normalizedTokens.fonts?.heading,
              previouslyExcluded: excludeStyleNames,
            });
          }
        } catch (persistErr) {
          console.warn('[delegateToDesignAdvisor] Non-fatal persist error:', persistErr);
        }
      }

      // Build a summary response for the parent agent to present
      const styleName = normalizedTokens.style?.name || 'Custom Design';
      const primary = normalizedTokens.colors?.primary || '#000';
      const secondary = normalizedTokens.colors?.secondary || '#666';
      const accent = normalizedTokens.colors?.accent || '#007AFF';
      const heading = normalizedTokens.fonts?.heading || 'Inter';
      const body = normalizedTokens.fonts?.body || 'Inter';

      const response = [
        `Generated a new design system: "${styleName}"`,
        `Colors: Primary ${primary}, Secondary ${secondary}, Accent ${accent}`,
        `Typography: ${heading} (headings) / ${body} (body)`,
        `Background: ${normalizedTokens.colors?.background || '#FFFFFF'}`,
        persisted ? 'Design tokens have been saved.' : 'Note: tokens could not be saved to database.',
      ].join('\n');

      return {
        success: true,
        response,
        designSystem: normalizedTokens,
        persisted,
      };
    } catch (error: any) {
      console.error("[delegateToDesignAdvisor] Error:", error.message);
      return {
        success: false,
        response: "",
        error: `Design regeneration failed: ${error.message}`,
      };
    }
  },
});
