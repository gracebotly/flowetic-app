import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Canonical style bundle display names.
 * The workflow MUST choose from this list for designSystem.style.name.
 * These map to the DB CHECK constraint values when slugified.
 */
const CANONICAL_STYLE_NAMES = [
  'Professional Clean',
  'Premium Dark',
  'Glass Premium',
  'Bold Startup',
  'Corporate Trust',
  'Neon Cyber',
  'Pastel Soft',
  'Warm Earth',
  'Modern SaaS',
] as const;

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
 * Helper function to generate a design system with the ui-ux-pro-max skill
 * Reusable for both primary and alternative design options
 */
async function generateDesignSystem(
  inputData: z.infer<typeof designSystemInputSchema>,
  mastra: any,
  requestContext: any,
  variation: "primary" | "alternative"
): Promise<z.infer<typeof designSystemOutputSchema>> {
  const agent = mastra.getAgent("designAdvisorAgent");

  if (!agent) {
    throw new Error("designAdvisorAgent not found in Mastra instance");
  }

  const variationPrompt = variation === "alternative"
    ? "This should contrast with a typical recommendation — if the default would be light and minimal, go bold and expressive, or vice versa. Provide a distinct alternative aesthetic."
    : "This should be your best recommendation for this workflow context.";

  const prompt = [
    `Generate the ${variation} design option for a ${inputData.platformType} dashboard.`,
    variationPrompt,
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
    `## CRITICAL: Style Name Constraint`,
    `You MUST choose designSystem.style.name from this EXACT list (copy verbatim):`,
    ...CANONICAL_STYLE_NAMES.map(name => `- "${name}"`),
    `Do NOT invent new style names like "Data-Dense BI/Analytics" or "Bold Expressive".`,
    `Pick the closest match from the list above.`,
    `Example mappings:`,
    `- Data/analytics dashboard → "Modern SaaS"`,
    `- Premium/luxury feel → "Premium Dark" or "Glass Premium"`,
    `- Startup/bold → "Bold Startup"`,
    `- Corporate/enterprise → "Corporate Trust" or "Professional Clean"`,
    `- Friendly/approachable → "Pastel Soft"`,
    `- Tech/cyber → "Neon Cyber"`,
    `- Natural/organic → "Warm Earth"`,
    ``,
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

  console.log(`[designSystemWorkflow:${variation}] Agent response length: ${result.text?.length ?? 0}`);
  console.log(`[designSystemWorkflow:${variation}] Agent response preview: ${result.text?.substring(0, 200)}`);

  // Parse the agent's response
  try {
    const text = result.text || "";

    // Strategy 1: Look for a JSON code block
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    // Strategy 2: Find the largest valid JSON object
    const jsonMatch = codeBlockMatch?.[1] || text.match(/\{[\s\S]*\}/)?.[0];

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch);
      const ds = parsed.designSystem || parsed;

      // Validate we got real data, not just empty strings
      if (ds?.colors?.primary && ds?.style?.name) {
        console.log(`[designSystemWorkflow:${variation}] Parsed design system: ${ds.style.name}, primary: ${ds.colors.primary}`);
        return {
          designSystem: ds,
          reasoning: parsed.reasoning || "Design system generated from tool results.",
          skillActivated: true,
        };
      }
      console.warn(`[designSystemWorkflow:${variation}] Parsed JSON but missing required fields`);
    }
  } catch (e) {
    console.warn(`[designSystemWorkflow:${variation}] Failed to parse JSON:`, (e as Error).message);
  }

  // Fallback with variation-specific defaults
  if (variation === "alternative") {
    return {
      designSystem: {
        style: { name: "Bold Startup", type: "Vibrant", keywords: "bold, colorful, expressive" },
        colors: {
          primary: "#7C3AED",
          secondary: "#14B8A6",
          accent: "#F59E0B",
          background: "#FFFFFF",
          text: "#111827"
        },
        typography: { headingFont: "Plus Jakarta Sans", bodyFont: "Inter", scale: "1.25" },
        charts: [{ type: "Area Chart", bestFor: "Trends over time" }],
        uxGuidelines: ["Use color to create visual hierarchy", "Bold typography for headings"],
      },
      reasoning: result.text || "Contrasting alternative for a bolder look.",
      skillActivated: true,
    };
  }

  // Primary fallback
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
}

// Step A: Generate first design option (the "recommended" style)
const designOptionA = createStep({
  id: "design-option-a",
  inputSchema: designSystemInputSchema,
  outputSchema: designSystemOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    return await generateDesignSystem(inputData, mastra, requestContext, "primary");
  },
});

// Step B: Generate second design option (a contrasting alternative)
const designOptionB = createStep({
  id: "design-option-b",
  inputSchema: designSystemInputSchema,
  outputSchema: designSystemOutputSchema,
  execute: async ({ inputData, mastra, requestContext }) => {
    return await generateDesignSystem(inputData, mastra, requestContext, "alternative");
  },
});

// Combine parallel results into a pair
const combineDesignOptions = createStep({
  id: "combine-design-options",
  inputSchema: z.object({
    "design-option-a": designSystemOutputSchema,
    "design-option-b": designSystemOutputSchema,
  }),
  outputSchema: z.object({
    designSystems: z.array(designSystemOutputSchema).length(2),
  }),
  execute: async ({ inputData }) => {
    return {
      designSystems: [
        inputData["design-option-a"],
        inputData["design-option-b"],
      ],
    };
  },
});

// BUG 4 FIX: Remove parallel execution to avoid OpenAI duplicate ID errors
// Premium plan: ONE intelligent design system, not 2 generic options
export const designSystemWorkflow = createWorkflow({
  id: "designSystemWorkflow",
  inputSchema: designSystemInputSchema,
  outputSchema: designSystemOutputSchema,  // Returns single system now
})
  .then(designOptionA)  // Generate ONE intelligent design
  .commit();
