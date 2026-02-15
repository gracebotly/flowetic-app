// mastra/tools/design/runDesignSystemWorkflow.ts
//
// Tool wrapper that lets the masterRouterAgent invoke designSystemWorkflow.
// Follows the same pattern as runGeneratePreviewWorkflow.
//
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { mastra } from "../../index";

export const runDesignSystemWorkflow = createTool({
  id: "runDesignSystemWorkflow",
  description: `Trigger the design system workflow to generate a complete design system recommendation.
This workflow activates the ui-ux-pro-max skill and searches across styles, colors, typography, charts, and UX guidelines.

USE THIS TOOL WHEN:
- User is in the style phase and needs design recommendations
- You need data-driven style suggestions (not from memory)
- User asks for style/theme/color/typography options

The workflow returns a structured design system with colors, typography, charts, and UX guidelines.
Present the results as 2 style options for the user to choose from.`,

  inputSchema: z.object({
    workflowName: z.string().describe("Name of the user's workflow"),
    platformType: z.string().describe("Platform type (e.g., n8n, make, vapi)"),
    selectedOutcome: z.string().optional().describe("Dashboard or Product"),
    selectedEntities: z.string().optional().describe("Comma-separated entity names"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    designSystems: z.array(z.object({
      designSystem: z.object({
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
          background: z.string(),
          text: z.string().optional(),
        }),
        typography: z.object({
          headingFont: z.string(),
          bodyFont: z.string(),
          scale: z.string().optional(),
        }),
        charts: z.array(z.object({
          type: z.string(),
          bestFor: z.string(),
        })).optional(),
        uxGuidelines: z.array(z.string()).optional(),
      }),
      reasoning: z.string().optional(),
    })).optional(),
    error: z.string().optional(),
  }),

  execute: async (inputData, context) => {
    const tenantId = context?.requestContext?.get('tenantId') as string;
    const userId = context?.requestContext?.get('userId') as string;

    if (!tenantId || !userId) {
      return {
        success: false,
        error: "Missing tenantId or userId in RequestContext",
      };
    }

    try {
      const workflow = mastra.getWorkflow("designSystemWorkflow");

      if (!workflow) {
        console.error("[runDesignSystemWorkflow] Workflow not found. Available workflows:",
          Object.keys((mastra as any).workflows || {}));

        // Fallback: Call designAdvisorAgent directly
        console.log("[runDesignSystemWorkflow] Falling back to direct designAdvisorAgent call");
        try {
          const agent = mastra.getAgent("designAdvisorAgent");
          if (agent) {
            const prompt = `Generate a design system for a ${inputData.platformType} dashboard called "${inputData.workflowName}".
Call getStyleRecommendations, getTypographyRecommendations, getChartRecommendations, and getProductRecommendations.
Return JSON with: designSystem { style, colors, typography, charts, uxGuidelines }, reasoning.`;

            const result = await agent.generate(prompt, {
              maxSteps: 10,
              toolChoice: "auto",
              requestContext: context?.requestContext,
            });

            // Try to parse result
            const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              // Fallback returns single system, wrap in array for compatibility
              return {
                success: true,
                designSystems: [{
                  designSystem: parsed.designSystem || parsed,
                  reasoning: parsed.reasoning || "Generated via direct agent fallback",
                }],
              };
            }
          }
        } catch (fallbackErr) {
          console.error("[runDesignSystemWorkflow] Agent fallback also failed:", fallbackErr);
        }
        return {
          success: false,
          error: "designSystemWorkflow not registered and agent fallback failed.",
        };
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
        },
        requestContext: context?.requestContext,
      });

      if (result.status === "success" && result.result) {
        const data = result.result as any;
        return {
          success: true,
          designSystems: data.designSystems,
        };
      }

      return {
        success: false,
        error: `Workflow finished with status: ${result.status}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[runDesignSystemWorkflow] Error:", message);
      return {
        success: false,
        error: message,
      };
    }
  },
});
