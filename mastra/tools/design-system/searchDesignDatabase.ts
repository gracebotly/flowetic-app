

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
  description: 'Search UI/UX Pro Max via Supabase (domain search). Serverless-compatible.',
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
    const rows = await loadUIUXCSV(inputData.domain);
    if (rows.length === 0) {
      return { success: false, output: '', error: `No data found for domain: ${inputData.domain}` };
    }

    // Use same ranking logic as Python script
    const ranked = rankRowsByQuery({
      rows,
      query: inputData.query,
      limit: inputData.maxResults ?? 3,
    });

    // Format output as ASCII table (similar to Python script)
    let output = '';
    for (const row of ranked) {
      output += '─'.repeat(60) + '\n';
      for (const [key, value] of Object.entries(row)) {
        output += `${key}: ${value}\n`;
      }
      output += '─'.repeat(60) + '\n\n';
    }

    if (ranked.length === 0) {
      output = `No results found for query: "${inputData.query}" in domain: ${inputData.domain}`;
    }

    return { success: true, output: output.trim() };
  },
});


