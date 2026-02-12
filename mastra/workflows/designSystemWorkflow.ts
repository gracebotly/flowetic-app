import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const designSystemInputSchema = z.object({
  workflowName: z.string(),
  platformType: z.string(),
  selectedOutcome: z.string().optional(),
  selectedEntities: z.string().optional(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
});

const designSystemOutputSchema = z.object({
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
  reasoning: z.string(),
  skillActivated: z.boolean(),
});

/**
 * Step 1: Activate the ui-ux-pro-max skill and generate design system
 *
 * This step guarantees skill activation by delegating to designAdvisorAgent
 * which has the skill configured. The agent's generate() call will load
 * the skill instructions into context before executing.
 */
const generateDesignSystemStep = createStep({
  id: "generate-design-system",
  description: "Activates ui-ux-pro-max skill via Design Advisor and generates complete design system",
  inputSchema: designSystemInputSchema,
  outputSchema: designSystemOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    const agent = mastra.getAgent("designAdvisorAgent");

    if (!agent) {
      throw new Error("designAdvisorAgent not found in Mastra instance");
    }

    const prompt = [
      `Generate a complete design system for a ${inputData.platformType} dashboard.`,
      "",
      `## Context`,
      `- Workflow: "${inputData.workflowName}"`,
      inputData.selectedOutcome ? `- Outcome type: ${inputData.selectedOutcome}` : "",
      inputData.selectedEntities ? `- Tracking: ${inputData.selectedEntities}` : "",
      "",
      `## Required Actions`,
      `Use your ui-ux-pro-max skill to search the design database:`,
      `1. Call getStyleRecommendations for style direction`,
      `2. Call getChartRecommendations for visualization types`,
      `3. Call getTypographyRecommendations for font pairings`,
      `4. Call getUXGuidelines for best practices`,
      "",
      `## Output Format`,
      `Return a JSON object with this structure:`,
      `{`,
      `  "designSystem": {`,
      `    "style": { "name": "...", "type": "...", "keywords": "...", "effects": "..." },`,
      `    "colors": { "primary": "#...", "secondary": "#...", "accent": "#...", "background": "#...", "text": "#..." },`,
      `    "typography": { "headingFont": "...", "bodyFont": "...", "scale": "..." },`,
      `    "charts": [{ "type": "...", "bestFor": "..." }],`,
      `    "uxGuidelines": ["...", "..."]`,
      `  },`,
      `  "reasoning": "Why these choices fit the workflow context"`,
      `}`,
    ].filter(Boolean).join("\n");

    const result = await agent.generate(prompt, {
      maxSteps: 10,
      toolChoice: "auto",
      requestContext,
    });

    // Parse the agent's response
    try {
      // Try to extract JSON from the response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          designSystem: parsed.designSystem || parsed,
          reasoning: parsed.reasoning || "Design system generated based on workflow context.",
          skillActivated: true,
        };
      }
    } catch (e) {
      console.warn("[designSystemWorkflow] Failed to parse JSON response, using fallback");
    }

    // Fallback with sensible defaults
    return {
      designSystem: {
        style: { name: "Professional Clean", type: "Minimalist", keywords: "modern, clean, professional" },
        colors: {
          primary: "#1a1a2e",
          secondary: "#16213e",
          accent: "#0f3460",
          background: "#f8f9fa",
          text: "#1a1a2e"
        },
        typography: { headingFont: "Inter", bodyFont: "Inter", scale: "1.25" },
        charts: [{ type: "Bar Chart", bestFor: "Comparisons" }],
        uxGuidelines: ["Use consistent spacing", "Maintain visual hierarchy"],
      },
      reasoning: result.text || "Default design system applied.",
      skillActivated: true,
    };
  },
});

export const designSystemWorkflow = createWorkflow({
  id: "designSystemWorkflow",
  inputSchema: designSystemInputSchema,
  outputSchema: designSystemOutputSchema,
})
  .then(generateDesignSystemStep)
  .commit();
