import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  OUTCOME_CATALOG,
  filterOutcomesByPlatform,
  VALID_EVENT_TYPES,
} from "@/data/outcomes";

export const getOutcomes = createTool({
  id: "outcomes.getOutcomes",
  description:
    "Get available outcome cards filtered by platform type. Validates metrics against Supabase events schema.",
  inputSchema: z.object({
    platformType: z.enum([
      "vapi",
      "retell",
      "n8n",
      "make",
      "zapier",
      "activepieces",
      "other",
    ]),
    category: z.enum(["dashboard", "product", "operations"]).optional(),
    audience: z.enum(["client", "internal", "both"]).optional(),
  }),
  outputSchema: z.object({
    outcomes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        platformTypes: z.array(z.string()),
        category: z.enum(["dashboard", "product", "operations"]),
        audience: z.enum(["client", "internal", "both"]),
        metrics: z.object({
          primary: z.array(z.string()),
          secondary: z.array(z.string()),
        }),
        previewImageUrl: z.string(),
        tags: z.array(z.string()),
        supportedEventTypes: z.array(z.string()),
        requiredEntityKinds: z.array(z.string()).optional(),
      })
    ),
    validation: z.object({
      totalOutcomes: z.number(),
      filteredOutcomes: z.number(),
      invalidMetrics: z.array(z.string()).optional(),
    }),
  }),
  execute: async (inputData) => {
    const { platformType, category, audience } = inputData;

    // Filter catalog
    let filtered = filterOutcomesByPlatform(platformType);

    if (category) {
      filtered = filtered.filter((o) => o.category === category);
    }

    if (audience) {
      filtered = filtered.filter(
        (o) => o.audience === audience || o.audience === "both"
      );
    }

    // Validate metrics against Supabase event types
    const invalidMetrics: string[] = [];
    for (const outcome of filtered) {
      for (const metric of [
        ...outcome.metrics.primary,
        ...outcome.metrics.secondary,
      ]) {
        if (!VALID_EVENT_TYPES.includes(metric)) {
          invalidMetrics.push(metric);
        }
      }
    }

    // Log validation issues (should be empty in production)
    if (invalidMetrics.length > 0) {
      console.error(
        "[TOOL][outcomes.getOutcomes] Invalid metrics found:",
        invalidMetrics
      );
    }

    return {
      outcomes: filtered,
      validation: {
        totalOutcomes: OUTCOME_CATALOG.length,
        filteredOutcomes: filtered.length,
        invalidMetrics:
          invalidMetrics.length > 0
            ? [...new Set(invalidMetrics)]
            : undefined,
      },
    };
  },
});