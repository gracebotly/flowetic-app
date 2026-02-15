






import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV } from "./loadUIUXCSV";
import { rankRowsByQuery } from "./_rank";

export const getProductRecommendations = createTool({
  id: "uiux.getProductRecommendations",
  description:
    "Get product recommendations from ui-ux-pro-max products.csv (industry patterns + style mapping).",
  inputSchema: z.object({
    productType: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        productType: z.string(),
        keywords: z.string(),
        primaryStyleRecommendation: z.string(),
        secondaryStyles: z.string(),
        landingPagePattern: z.string(),
        dashboardStyle: z.string(),
        colorPaletteFocus: z.string(),
        keyConsiderations: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async (inputData) => {
    const rows = await loadUIUXCSV("product");
    if (rows.length === 0) return { recommendations: [], count: 0 };

    const query = [inputData.productType, ...(inputData.keywords ?? [])].filter(Boolean).join(" ");

    const ranked = await rankRowsByQuery({ rows, query, limit: inputData.limit ?? 3, domain: 'product' });

    const recommendations = ranked.map((row) => ({
      productType: row["Product Type"] || "",
      keywords: row["Keywords"] || "",
      primaryStyleRecommendation: row["Primary Style Recommendation"] || "",
      secondaryStyles: row["Secondary Styles"] || "",
      landingPagePattern: row["Landing Page Pattern"] || "",
      dashboardStyle: row["Dashboard Style (if applicable)"] || "",
      colorPaletteFocus: row["Color Palette Focus"] || "",
      keyConsiderations: row["Key Considerations"] || "",
    }));

    return { recommendations, count: recommendations.length };
  },
});





