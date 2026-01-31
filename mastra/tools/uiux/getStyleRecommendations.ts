

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getStyleRecommendations = createTool({
  id: "uiux.getStyleRecommendations",
  description:
    "Get style recommendations from ui-ux-pro-max styles.csv based on product type, keywords, and audience.",
  inputSchema: z.object({
    productType: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    audience: z.string().optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        styleCategory: z.string(),
        type: z.string(),
        keywords: z.string(),
        primaryColors: z.string(),
        effects: z.string(),
        bestFor: z.string(),
        performance: z.string(),
        accessibility: z.string(),
        frameworkCompatibility: z.string(),
        complexity: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async (inputData) => {
    const rows = await loadUIUXCSV("style");
    if (rows.length === 0) return { recommendations: [], count: 0 };

    const query = [inputData.productType, ...(inputData.keywords ?? []), inputData.audience]
      .filter(Boolean)
      .join(" ");

    const ranked = rankRowsByQuery({ rows, query, limit: inputData.limit });

    const recommendations = ranked.map((row) => ({
      styleCategory: row["Style Category"] || "",
      type: row["Type"] || "",
      keywords: row["Keywords"] || "",
      primaryColors: row["Primary Colors"] || "",
      effects: row["Effects & Animation"] || "",
      bestFor: row["Best For"] || "",
      performance: row["Performance"] || "",
      accessibility: row["Accessibility"] || "",
      frameworkCompatibility: row["Framework Compatibility"] || "",
      complexity: row["Complexity"] || "",
    }));

    return { recommendations, count: recommendations.length };
  },
});

