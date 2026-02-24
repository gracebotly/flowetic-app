// mastra/tools/design/runDesignSystemWorkflow.ts
//
// Tool wrapper that lets the masterRouterAgent invoke designSystemWorkflow.
// Returns a single design system (not an array) and persists to journey_sessions.
//
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { mastra } from "../../index";
import { createAuthenticatedClient } from "../../lib/supabase";

const designSystemSchema = z.object({
  style: z.object({
    name: z.string(),
    type: z.string(),
    keywords: z.string().optional(),
    effects: z.string().optional(),
  }),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    success: z.string().optional(),
    warning: z.string().optional(),
    error: z.string().optional(),
    background: z.string(),
    text: z.string().optional(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }).optional(),
  spacing: z.object({ unit: z.number() }).optional(),
  radius: z.number().optional(),
  shadow: z.string().optional(),
  charts: z.array(z.object({
    type: z.string(),
    bestFor: z.string(),
  })).optional(),
  uxGuidelines: z.array(z.string()).optional(),
});

export const runDesignSystemWorkflow = createTool({
  id: "runDesignSystemWorkflow",
  description: `Trigger the design system workflow to generate a custom design system for this specific workflow.
This workflow creates unique colors, typography, and UX guidelines tailored to the workflow context.

USE THIS TOOL WHEN:
- User enters the style phase
- User needs design recommendations
- User asks for style/theme/color/typography options

The workflow returns ONE complete custom design system. Present it to the user and ask if they'd like
to proceed with it or request adjustments.`,

  inputSchema: z.object({
    workflowName: z.string().describe("Name of the user's workflow"),
    platformType: z.string().describe("Platform type (e.g., n8n, make, vapi)"),
    selectedOutcome: z.string().optional().describe("Dashboard or Product"),
    selectedEntities: z.string().optional().describe("Comma-separated entity names"),
    userFeedback: z.string().optional().describe("User's style preference or rejection reason (e.g. 'darker', 'more premium', 'navy blue'). Pass this to get DIFFERENT results than the initial generation."),
    excludeStyleNames: z.array(z.string()).optional().describe("Style names to exclude from results (e.g. names of previously rejected designs)"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    designSystem: designSystemSchema.optional(),
    reasoning: z.string().optional(),
    persisted: z.boolean().optional(),
    error: z.string().optional(),
  }),

  execute: async (inputData, context) => {
    const tenantId = context?.requestContext?.get('tenantId') as string;
    const userId = context?.requestContext?.get('userId') as string;
    const journeyThreadId = context?.requestContext?.get('journeyThreadId') as string;
    const supabaseToken = context?.requestContext?.get('supabaseAccessToken') as string;

    if (!tenantId || !userId) {
      return { success: false, error: "Missing tenantId or userId in RequestContext" };
    }

    try {
      const workflow = mastra.getWorkflow("designSystemWorkflow");

      if (!workflow) {
        console.error("[runDesignSystemWorkflow] Workflow not found — falling back to designAdvisorAgent");
        try {
          const agent = mastra.getAgent("designAdvisorAgent");
          if (agent) {
            const prompt = `Generate a UNIQUE custom design system for a ${inputData.platformType} dashboard called "${inputData.workflowName}".
Outcome: ${inputData.selectedOutcome || "dashboard"}. Entities: ${inputData.selectedEntities || "workflow metrics"}.
Call getStyleRecommendations, getTypographyRecommendations, getChartRecommendations, and getProductRecommendations.
Return JSON with: { designSystem: { style: { name, type, keywords, effects }, colors: { primary, secondary, accent, success, warning, error, background, text }, fonts: { heading, body }, spacing: { unit }, radius, shadow, charts, uxGuidelines }, reasoning }.
Be creative — this should feel crafted for THIS specific workflow, not generic.`;

            const result = await agent.generate(prompt, {
              maxSteps: 10,
              toolChoice: "auto",
              requestContext: context?.requestContext,
            });

            const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const ds = parsed.designSystem || parsed;
              return { success: true, designSystem: ds, reasoning: parsed.reasoning || "Generated via agent fallback" };
            }
          }
        } catch (fallbackErr) {
          console.error("[runDesignSystemWorkflow] Agent fallback failed:", fallbackErr);
        }
        return { success: false, error: "designSystemWorkflow not registered and agent fallback failed." };
      }

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          workflowName: inputData.workflowName,
          platformType: inputData.platformType,
          selectedOutcome: inputData.selectedOutcome || "dashboard",
          selectedEntities: inputData.selectedEntities || "",
          tenantId,
          userId,
          // Variety parameters: shift BM25 ranking and exclude previously rejected styles
          userFeedback: inputData.userFeedback || undefined,
          excludeStyleNames: inputData.excludeStyleNames || undefined,
        },
        requestContext: context?.requestContext,
      });

      if (result.status !== "success" || !result.result) {
        return { success: false, error: `Workflow finished with status: ${result.status}` };
      }

      const data = result.result as any;
      // BUG 4 FIX: Workflow now returns single design system
      const designSystem: any = data.designSystem;
      const reasoning: string = data.reasoning ?? "";
      const rawPatterns = data.rawPatterns ?? null;

      if (!designSystem) {
        return { success: false, error: "Workflow returned no design system" };
      }

      // ── Normalize design tokens before persistence ──────────────────────
      // The workflow outputs typography.headingFont/bodyFont but consumers
      // read fonts.heading/fonts.body. Map between schemas here.
      const normalizedTokens = {
        ...designSystem,
        // Ensure fonts object exists with correct keys
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
        // Ensure semantic colors exist
        colors: {
          ...designSystem.colors,
          success: designSystem.colors?.success || '#10B981',
          warning: designSystem.colors?.warning || '#F59E0B',
          error: designSystem.colors?.error || '#EF4444',
          text: designSystem.colors?.text || '#0F172A',
        },
        // Ensure spacing/radius/shadow exist
        spacing: designSystem.spacing || { unit: 8 },
        radius: designSystem.radius ?? 8,
        shadow: designSystem.shadow || 'soft',
        // Phase 3: Preserve raw BM25 patterns for downstream layout intelligence
        rawPatterns: rawPatterns || undefined,
      };
      console.log('[runDesignSystemWorkflow] Normalized tokens:', {
        styleName: normalizedTokens.style?.name,
        primary: normalizedTokens.colors?.primary,
        heading: normalizedTokens.fonts?.heading,
        googleFontsUrl: normalizedTokens.fonts?.googleFontsUrl?.substring(0, 60),
      });
      // Persist normalized tokens to journey_sessions
      let persisted = false;
      if (journeyThreadId && supabaseToken && tenantId) {
        try {
          const supabase = createAuthenticatedClient(supabaseToken);
          const { error: persistErr } = await supabase
            .from('journey_sessions')
            .update({
              design_tokens: normalizedTokens,
              selected_style_bundle_id: 'custom',
              updated_at: new Date().toISOString(),
            })
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', tenantId);

          if (persistErr) {
            console.error('[runDesignSystemWorkflow] Failed to persist design_tokens:', persistErr.message);
          } else {
            persisted = true;
            // Also update RequestContext for this request cycle
            if (context?.requestContext) {
              context.requestContext.set('designTokens', JSON.stringify(normalizedTokens));
              context.requestContext.set('designSystemGenerated', 'true');
            }
            console.log('[runDesignSystemWorkflow] ✅ Persisted normalized design_tokens:', {
              styleName: normalizedTokens.style?.name,
              primary: normalizedTokens.colors?.primary,
              heading: normalizedTokens.fonts?.heading,
            });
          }
        } catch (persistErr) {
          console.warn('[runDesignSystemWorkflow] Non-fatal persist error:', persistErr);
        }
      }

      return { success: true, designSystem: normalizedTokens, reasoning, persisted };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[runDesignSystemWorkflow] Error:", message);
      return { success: false, error: message };
    }
  },
});
