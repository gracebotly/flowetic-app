import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { OUTCOMES, filterOutcomesByPlatform } from "@/data/outcomes";

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
    console.log('[getOutcomes] Tool called with:', inputData);
    console.log('[getOutcomes] Writer available:', !!context?.writer);

    const { platformType } = inputData;

    try {
      const filtered = filterOutcomesByPlatform(platformType);
      console.log('[getOutcomes] Filtered outcomes:', filtered.length);

      const dashboardOutcome = filtered.find((o) => o.category === "dashboard");
      const productOutcome = filtered.find((o) => o.category === "product");

      console.log('[getOutcomes] Dashboard outcome:', !!dashboardOutcome);
      console.log('[getOutcomes] Product outcome:', !!productOutcome);

      // ✅ STREAM CUSTOM UI DATA
      if (dashboardOutcome && productOutcome && context?.writer) {
        console.log('[getOutcomes] Attempting to stream custom UI...');

        try {
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
          } as any);

          console.log('[getOutcomes] Custom UI streamed successfully');
        } catch (streamError) {
          console.error('[getOutcomes] Error streaming custom UI:', streamError);
        }
      } else {
        console.warn('[getOutcomes] Skipping custom UI stream:', {
          hasDashboard: !!dashboardOutcome,
          hasProduct: !!productOutcome,
          hasWriter: !!context?.writer,
        });
      }

      // Return structured data
      const outcomes = [dashboardOutcome, productOutcome]
        .filter(Boolean)
        .map((o) => ({
          id: o!.id,
          label: o!.name,
          description: o!.description,
        }));

      console.log('[getOutcomes] Returning outcomes:', outcomes.length);
      return { outcomes };

    } catch (error) {
      console.error('[getOutcomes] Tool execution error:', error);
      throw error;
    }
  },
});
