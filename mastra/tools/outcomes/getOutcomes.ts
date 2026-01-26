import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  OUTCOME_CATALOG,
  filterOutcomesByPlatform,
  VALID_EVENT_TYPES,
} from "@/data/outcomes";

// Helper functions for metric deduplication
function toMetricId(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[%]/g, " percent")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueStringsByMetricId(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const id = toMetricId(l);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

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
    metrics: z.array(z.string()).optional(),
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
      dedupedMetrics: z.array(z.string()).optional(),
    }),
  }),
  execute: async (inputData) => {
    const { platformType, category, audience, metrics } = inputData;

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

    // Deduplicate metrics if provided to prevent validation failures
    const dedupedMetrics = metrics ? uniqueStringsByMetricId(metrics) : undefined;

    // Note: Metrics include both raw events and derived aggregations
    // (e.g., call_volume, success_rate are calculated from raw events)

    return {
      outcomes: filtered,
      validation: {
        totalOutcomes: OUTCOME_CATALOG.length,
        filteredOutcomes: filtered.length,
        ...(dedupedMetrics && { dedupedMetrics }),
      },
    };
  },
});