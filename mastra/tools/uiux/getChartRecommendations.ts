


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getChartRecommendations = createTool({
  id: "uiux.getChartRecommendations",
  description:
    "Get chart recommendations from ui-ux-pro-max charts.csv based on data type, keywords, and accessibility needs.",
  inputSchema: z.object({
    dataType: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    accessibility: z.boolean().optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        dataType: z.string(),
        keywords: z.string(),
        bestChartType: z.string(),
        secondaryOptions: z.string(),
        colorGuidance: z.string(),
        accessibilityNotes: z.string(),
        libraryRecommendation: z.string(),
        interactiveLevel: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async (inputData) => {
    const rows = await loadUIUXCSV("chart");
    if (rows.length === 0) return { recommendations: [], count: 0 };

    const query = [
      inputData.dataType,
      ...(inputData.keywords ?? []),
      inputData.accessibility ? "accessible accessibility wcag" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const ranked = rankRowsByQuery({ rows, query, limit: inputData.limit ?? 3 });

    const recommendations = ranked.map((row) => ({
      dataType: row["Data Type"] || "",
      keywords: row["Keywords"] || "",
      bestChartType: row["Best Chart Type"] || "",
      secondaryOptions: row["Secondary Options"] || "",
      colorGuidance: row["Color Guidance"] || "",
      accessibilityNotes: row["Accessibility Notes"] || "",
      libraryRecommendation: row["Library Recommendation"] || "",
      interactiveLevel: row["Interactive Level"] || "",
    }));

    return { recommendations, count: recommendations.length };
  },
});


