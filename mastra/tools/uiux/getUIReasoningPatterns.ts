
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getUIReasoningPatterns = createTool({
  id: "getUIReasoningPatterns",
  description: `Search UI design reasoning and decision-making patterns.

Examples: "color choice rationale", "spacing decisions", "hierarchy principles", "cognitive load"

Returns: reasoning pattern, decision criteria, psychological basis, application examples.`,

  inputSchema: z.object({
    query: z.string().describe("Design decision or reasoning topic"),
    limit: z.number().optional().default(3).describe("Max results (default 3)"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        pattern: z.string(),
        criteria: z.string(),
        psychologyBasis: z.string(),
        examples: z.string(),
      })
    ),
    count: z.number(),
  }),

  execute: async (inputData) => {
    const rows = await loadUIUXCSV("ui-reasoning");
    if (rows.length === 0) {
      return { recommendations: [], count: 0 };
    }

    const ranked = await rankRowsByQuery({
      rows,
      query: inputData.query,
      limit: inputData.limit ?? 3,
      domain: 'ui-reasoning',
    });

    return {
      recommendations: ranked.map((row) => ({
        pattern: row["pattern"] || "",
        criteria: row["criteria"] || "",
        psychologyBasis: row["psychology_basis"] || "",
        examples: row["examples"] || "",
      })),
      count: ranked.length,
    };
  },
});
