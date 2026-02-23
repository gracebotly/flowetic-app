
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getColorRecommendations = createTool({
  id: "getColorRecommendations",
  description: `Search 21 color palettes by mood, industry, and use case.

Examples: "corporate professional", "creative bold", "healthcare calming", "fintech trustworthy"

Returns: palette name, primary/secondary/accent colors (hex), mood, use cases.`,

  inputSchema: z.object({
    query: z.string().describe("Mood, industry, or use case keywords"),
    limit: z.number().optional().default(3).describe("Max results (default 3)"),
  }),

  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        paletteName: z.string(),
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        mood: z.string(),
        useCases: z.string(),
      })
    ),
    count: z.number(),
  }),

  execute: async (inputData) => {
    const rows = await loadUIUXCSV("color");
    if (rows.length === 0) {
      return { recommendations: [], count: 0 };
    }

    const ranked = await rankRowsByQuery({
      rows,
      query: inputData.query,
      limit: inputData.limit ?? 3,
      domain: 'color',
    });

    return {
      recommendations: ranked.map((row) => ({
        paletteName: row["Product Type"] || row["palette_name"] || "",
        primary: row["Primary (Hex)"] || row["primary"] || row["Primary"] || "",
        secondary: row["Secondary (Hex)"] || row["secondary"] || row["Secondary"] || "",
        accent: row["CTA (Hex)"] || row["accent"] || row["Accent"] || "",
        mood: row["Notes"] || row["mood"] || row["Mood"] || "",
        useCases: row["Product Type"] || row["use_cases"] || "",
      })),
      count: ranked.length,
    };
  },
});
