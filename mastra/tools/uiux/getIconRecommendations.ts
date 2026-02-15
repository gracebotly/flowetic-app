
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getIconRecommendations = createTool({
  id: "getIconRecommendations",
  description: `Search icon libraries and styles by use case, aesthetic, and platform.

Examples: "dashboard icons minimal", "mobile app rounded", "data visualization sharp", "enterprise professional"

Returns: icon library/style, aesthetic, use cases, library recommendations.`,

  inputSchema: z.object({
    query: z.string().describe("Use case, aesthetic, or platform keywords"),
    limit: z.number().optional().default(3).describe("Max results (default 3)"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        iconStyle: z.string(),
        aesthetic: z.string(),
        useCases: z.string(),
        libraries: z.string(),
      })
    ),
    count: z.number(),
  }),

  execute: async (inputData) => {
    const rows = await loadUIUXCSV("icons");
    if (rows.length === 0) {
      return { recommendations: [], count: 0 };
    }

    const ranked = await rankRowsByQuery({
      rows,
      query: inputData.query,
      limit: inputData.limit ?? 3,
      domain: 'icons',
    });

    return {
      recommendations: ranked.map((row) => ({
        iconStyle: row["icon_style"] || "",
        aesthetic: row["aesthetic"] || "",
        useCases: row["use_cases"] || "",
        libraries: row["libraries"] || "",
      })),
      count: ranked.length,
    };
  },
});
