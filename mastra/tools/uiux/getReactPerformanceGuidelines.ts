
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getReactPerformanceGuidelines = createTool({
  id: "getReactPerformanceGuidelines",
  description: `Search React/Next.js performance optimization patterns.

Examples: "rendering optimization", "code splitting", "lazy loading", "state management", "memo strategies"

Returns: optimization technique, implementation, impact level, code examples.`,

  inputSchema: z.object({
    query: z.string().describe("Performance topic or optimization pattern"),
    limit: z.number().optional().default(3).describe("Max results (default 3)"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        technique: z.string(),
        implementation: z.string(),
        impact: z.string(),
        codeExample: z.string(),
      })
    ),
    count: z.number(),
  }),

  execute: async (inputData) => {
    const rows = await loadUIUXCSV("react-performance");
    if (rows.length === 0) {
      return { recommendations: [], count: 0 };
    }

    const ranked = await rankRowsByQuery({
      rows,
      query: inputData.query,
      limit: inputData.limit ?? 3,
      domain: 'react-performance',
    });

    return {
      recommendations: ranked.map((row) => ({
        technique: row["technique"] || "",
        implementation: row["implementation"] || "",
        impact: row["impact"] || "",
        codeExample: row["code_example"] || "",
      })),
      count: ranked.length,
    };
  },
});
