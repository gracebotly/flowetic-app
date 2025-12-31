


import { Tool } from "@mastra/core/tool";
import { z } from "zod";
import { loadDesignKBFiles } from "./loadDesignKB";

export const searchDesignKBLocal = new Tool({
  id: "searchDesignKBLocal",
  description:
    "Keyword-based search through the local design knowledge base. Use this as a fallback when searchDesignKB (vector-based) is unavailable or returns no results.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Keywords to search for in the design knowledge base"),
  }),
  outputSchema: z.object({
    results: z
      .array(
        z.object({
          file: z.string().describe("Filename of the matched document"),
          snippet: z.string().describe("Relevant text snippet"),
          relevance: z.number().describe("Relevance score (0-1)"),
        })
      )
      .describe("Matching results from the design KB"),
  }),
  async execute({ context }) {
    const { query } = context;
    const lowerQuery = query.toLowerCase();
    const keywords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    const files = await loadDesignKBFiles();

    if (files.length === 0) {
      return {
        results: [],
      };
    }

    const results = files
      .map((file) => {
        const lowerContent = file.content.toLowerCase();
        
        let matchCount = 0;
        for (const keyword of keywords) {
          const regex = new RegExp(keyword, "gi");
          const matches = lowerContent.match(regex);
          matchCount += matches ? matches.length : 0;
        }

        if (matchCount === 0) return null;

        const relevance = Math.min(
          1,
          matchCount / (file.content.length / 1000)
        );

        const firstKeyword = keywords[0];
        const matchIndex = lowerContent.indexOf(firstKeyword);
        const snippetStart = Math.max(0, matchIndex - 150);
        const snippetEnd = Math.min(
          file.content.length,
          matchIndex + 300
        );
        const snippet = file.content.slice(snippetStart, snippetEnd).trim();

        return {
          file: file.path,
          snippet: `...${snippet}...`,
          relevance,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);

    return { results };
  },
});


