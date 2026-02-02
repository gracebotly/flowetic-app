

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadUIUXCSV, type UIUXCSVRow } from '../uiux/loadUIUXCSV';
import { rankRowsByQuery } from '../uiux/_rank';

const Domain = z.enum(["style", "color", "typography", "landing", "chart", "ux", "product", "icons"]);

// Map domains to their search columns (for ranking)
const SEARCH_COLUMNS: Record<string, string[]> = {
  style: ['Style Category', 'Keywords', 'Best For', 'Type', 'AI Prompt Keywords'],
  color: ['Product Type', 'Notes'],
  chart: ['Data Type', 'Keywords', 'Best Chart Type', 'Accessibility Notes'],
  landing: ['Pattern Name', 'Keywords', 'Conversion Optimization', 'Section Order'],
  product: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
  ux: ['Category', 'Issue', 'Description', 'Platform'],
  typography: ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For'],
  icons: ['Category', 'Icon Name', 'Keywords', 'Best For'],
};

export const searchDesignDatabase = createTool({
  id: "designDatabase.search",
  description: "Search UI/UX Pro Max via Supabase-backed dataset (domain search).",
  inputSchema: z.object({
    query: z.string().min(1),
    domain: Domain,
    maxResults: z.number().int().min(1).max(10).default(3),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData) => {
    try {
      const rows = await loadUIUXCSV(inputData.domain);
      if (!rows.length) {
        return { success: false, output: "", error: `NO_DATA_FOR_DOMAIN:${inputData.domain}` };
      }

      const ranked = rankRowsByQuery({
        rows,
        query: inputData.query,
        limit: inputData.maxResults ?? 3,
      });

      if (!ranked.length) {
        return { success: true, output: `No results for "${inputData.query}" in ${inputData.domain}.` };
      }

      // Keep output format simple + stable
      const output = ranked
        .map((row) =>
          Object.entries(row)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
        )
        .join("\n\n---\n\n");

      return { success: true, output };
    } catch (e: any) {
      return { success: false, output: "", error: e?.message ?? "DESIGN_DB_SEARCH_FAILED" };
    }
  },
});


