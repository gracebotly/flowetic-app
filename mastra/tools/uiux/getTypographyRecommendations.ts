



import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getTypographyRecommendations = createTool({
  id: "uiux.getTypographyRecommendations",
  description:
    "Get typography recommendations from ui-ux-pro-max typography.csv based on mood, category, and best-for context.",
  inputSchema: z.object({
    moodKeywords: z.array(z.string()).optional(),
    category: z.string().optional(),
    bestFor: z.string().optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        fontPairingName: z.string(),
        category: z.string(),
        headingFont: z.string(),
        bodyFont: z.string(),
        moodStyleKeywords: z.string(),
        bestFor: z.string(),
        googleFontsUrl: z.string(),
        cssImport: z.string(),
        tailwindConfig: z.string(),
        notes: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async (inputData) => {
    const rows = await loadUIUXCSV("typography");
    if (rows.length === 0) return { recommendations: [], count: 0 };

    const query = [...(inputData.moodKeywords ?? []), inputData.category, inputData.bestFor]
      .filter(Boolean)
      .join(" ");

    const ranked = rankRowsByQuery({ rows, query, limit: inputData.limit ?? 3 });

    const recommendations = ranked.map((row) => ({
      fontPairingName: row["Font Pairing Name"] || "",
      category: row["Category"] || "",
      headingFont: row["Heading Font"] || "",
      bodyFont: row["Body Font"] || "",
      moodStyleKeywords: row["Mood/Style Keywords"] || "",
      bestFor: row["Best For"] || "",
      googleFontsUrl: row["Google Fonts URL"] || "",
      cssImport: row["CSS Import"] || "",
      tailwindConfig: row["Tailwind Config"] || "",
      notes: row["Notes"] || "",
    }));

    return { recommendations, count: recommendations.length };
  },
});


