
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getLandingPagePatterns = createTool({
  id: "getLandingPagePatterns",
  description: `Search landing page patterns by product type, industry, and conversion goal.

Examples: "saas product launch", "e-commerce storefront", "portfolio showcase", "lead generation"

Returns: pattern name, sections, cta strategy, conversion optimizations.`,

  inputSchema: z.object({
    query: z.string().describe("Product type, industry, or goal keywords"),
    limit: z.number().optional().default(3).describe("Max results (default 3)"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        patternName: z.string(),
        sections: z.string(),
        ctaStrategy: z.string(),
        optimizations: z.string(),
      })
    ),
    count: z.number(),
  }),

  execute: async (inputData) => {
    const rows = await loadUIUXCSV("landing");
    if (rows.length === 0) {
      return { recommendations: [], count: 0 };
    }

    const ranked = await rankRowsByQuery({
      rows,
      query: inputData.query,
      limit: inputData.limit ?? 3,
    });

    return {
      recommendations: ranked.map((row) => ({
        patternName: row["pattern_name"] || "",
        sections: row["sections"] || "",
        ctaStrategy: row["cta_strategy"] || "",
        optimizations: row["optimizations"] || "",
      })),
      count: ranked.length,
    };
  },
});
