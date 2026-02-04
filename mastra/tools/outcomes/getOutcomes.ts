import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { OUTCOME_CATALOG, filterOutcomesByPlatform } from "@/data/outcomes";

export const getOutcomes = createTool({
  id: "getOutcomes",
  description: "Show Dashboard vs Product outcome choices with streaming UI",

  inputSchema: z.object({
    platformType: z.string(),
  }),

  outputSchema: z.object({
    outcomes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
      })
    ),
  }),

  execute: async (inputData, context) => {
    const { platformType } = inputData;

    const filtered = filterOutcomesByPlatform(platformType);
    const dashboardOutcome = filtered.find((o) => o.category === "dashboard");
    const productOutcome = filtered.find((o) => o.category === "product");

    // ✅ STREAM CUSTOM UI DATA
    if (dashboardOutcome && productOutcome && context?.writer) {
      await context.writer.custom({
        type: "data-outcome-choices",
        choices: [
          {
            id: dashboardOutcome.id,
            label: "Dashboard",
            emoji: "📊",
            description: dashboardOutcome.description,
            tags: dashboardOutcome.tags?.slice(0, 3) || [],
          },
          {
            id: productOutcome.id,
            label: "Product",
            emoji: "🚀",
            description: productOutcome.description,
            tags: productOutcome.tags?.slice(0, 3) || [],
          },
        ],
        helpAvailable: true,
      } as any); // Type assertion - AI SDK preserves properties at runtime
    }

    return {
      outcomes: [dashboardOutcome, productOutcome]
        .filter(Boolean)
        .map((o) => ({
          id: o!.id,
          label: o!.name,
          description: o!.description,
        })),
    };
  },
});
