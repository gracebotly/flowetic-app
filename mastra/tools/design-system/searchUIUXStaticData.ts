import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchUIUXData, STYLES, COLORS, TYPOGRAPHY, PRODUCTS } from "../../data/uiuxStaticData";

/**
 * Search UI/UX Pro Max static data.
 * Serverless-compatible replacement for Python-based searchDesignDatabase.
 */
export const searchUIUXStaticData = createTool({
  id: "designSystem.searchStatic",
  description: "Search UI/UX Pro Max design database (styles, colors, typography, products). Returns matching entries for dashboard design recommendations.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search query (e.g., 'voice AI dashboard', 'premium glass')"),
    domain: z.enum(["style", "color", "typography", "product"]).describe("Which domain to search"),
    maxResults: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    domain: z.string(),
    query: z.string(),
    count: z.number(),
    results: z.array(z.record(z.any())),
  }),
  execute: async (inputData) => {
    const { query, domain, maxResults } = inputData;

    try {
      const results = searchUIUXData(query, domain, maxResults);

      return {
        success: true,
        domain,
        query,
        count: results.length,
        results,
      };
    } catch (err: any) {
      console.error(`[searchUIUXStaticData] Error:`, err);
      return {
        success: false,
        domain,
        query,
        count: 0,
        results: [],
      };
    }
  },
});

/**
 * Generate a complete design system recommendation from static data.
 * Serverless-compatible replacement for Python-based generateDesignSystem.
 */
export const generateDesignSystemStatic = createTool({
  id: "designSystem.generateStatic",
  description: "Generate a complete design system recommendation for a dashboard. Combines style, color, and typography recommendations.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Dashboard description (e.g., 'WooCommerce support agent dashboard for business clients')"),
    audience: z.enum(["client", "ops"]).default("client"),
    platformType: z.string().optional().describe("Platform type (n8n, make, vapi, retell, woocommerce)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    designSystem: z.object({
      style: z.record(z.any()).optional(),
      color: z.record(z.any()).optional(),
      typography: z.record(z.any()).optional(),
      product: z.record(z.any()).optional(),
      recommendations: z.string(),
    }),
  }),
  execute: async (inputData) => {
    const { query, audience, platformType } = inputData;

    try {
      // Build search query from inputs
      const searchQuery = [query, platformType, audience === "ops" ? "technical ops" : "client-facing"].filter(Boolean).join(" ");

      // Search each domain
      const [styles, colors, typographies, products] = await Promise.all([
        searchUIUXData(searchQuery, "style", 2),
        searchUIUXData(searchQuery, "color", 2),
        searchUIUXData(searchQuery, "typography", 1),
        searchUIUXData(searchQuery, "product", 1),
      ]);

      const style = styles[0];
      const color = colors[0];
      const typography = typographies[0];
      const product = products[0];

      // Build recommendations text
      const recommendations = [
        `**Style:** ${style?.name || "Minimalism"} - ${style?.bestFor || "Professional dashboards"}`,
        `**Colors:** Primary ${color?.primary || "#2563EB"}, CTA ${color?.cta || "#22C55E"}`,
        `**Typography:** ${typography?.pairingName || "Inter + System"}`,
        product ? `**Pattern:** ${product.dashboardStyle}` : "",
        product?.antiPatterns ? `**Avoid:** ${product.antiPatterns}` : "",
      ].filter(Boolean).join("\n");

      return {
        success: true,
        designSystem: {
          style,
          color,
          typography,
          product,
          recommendations,
        },
      };
    } catch (err: any) {
      console.error(`[generateDesignSystemStatic] Error:`, err);
      return {
        success: false,
        designSystem: {
          recommendations: "Using safe defaults: Minimalism style with professional blue palette.",
        },
      };
    }
  },
});
