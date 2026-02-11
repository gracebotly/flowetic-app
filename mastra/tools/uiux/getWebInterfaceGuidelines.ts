
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getWebInterfaceGuidelines = createTool({
  id: "getWebInterfaceGuidelines",
  description: `Search web interface patterns and best practices by component type and interaction.

Examples: "navigation patterns", "form design", "modal dialogs", "data tables", "search interfaces"

Returns: pattern name, best practices, do/don't examples, accessibility notes.`,

  inputSchema: z.object({
    query: z.string().describe("Component type or interaction keywords"),
    limit: z.number().optional().default(3).describe("Max results (default 3)"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        patternName: z.string(),
        bestPractices: z.string(),
        examples: z.string(),
        accessibility: z.string(),
      })
    ),
    count: z.number(),
  }),

  execute: async (inputData) => {
    const rows = await loadUIUXCSV("web-interface");
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
        bestPractices: row["best_practices"] || "",
        examples: row["examples"] || "",
        accessibility: row["accessibility"] || "",
      })),
      count: ranked.length,
    };
  },
});
