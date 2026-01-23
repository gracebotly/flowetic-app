


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadDesignKBFiles } from "./loadDesignKB";

export const searchDesignKBLocal = createTool({
  id: "searchDesignKBLocal",
  description: "Keyword-based local search of design knowledge base (fallback when RAG is unavailable)",
  inputSchema: z.object({
    queryText: z.string().describe("The search query text"),
    maxChars: z.number().optional().default(2000).describe("Maximum characters to return"),
  }),
  outputSchema: z.object({
    relevantText: z.string(),
    sources: z.array(z.object({
      kind: z.string(),
      note: z.string(),
    })),
  }),
  execute: async (inputData: any, context: any) => {
    const { queryText, maxChars } = inputData;
    const q = queryText.toLowerCase();
    const terms = q
      .split(/\s+/)
      .filter((t: string) => t.length > 2)
      .slice(0, 10);

    // Simple keyword matching logic
    // TODO: Replace with your actual local search implementation
    const knowledgeBase = [
      {
        kind: "design-system",
        content: "Use consistent spacing, modern typography, and accessible color contrast for premium dashboards.",
        note: "Premium design guidelines",
      },
    ];

    let relevantText = "";
    const sources: Array<{ kind: string; note: string }> = [];

    for (const item of knowledgeBase) {
      const content = item.content.toLowerCase();
      const matches = terms.filter((term: string) => content.includes(term));
      if (matches.length > 0) {
        relevantText += item.content + "\n\n";
        sources.push({ kind: item.kind, note: item.note });
      }
    }

    const limit = maxChars ?? 2000;
    if (relevantText.length > limit) {
      relevantText = relevantText.slice(0, limit) + "...";
    }

    return {
      relevantText: relevantText.trim() || "No relevant design guidance found.",
      sources,
    };
  },
});


