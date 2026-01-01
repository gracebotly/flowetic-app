


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadDesignKBFiles } from "./loadDesignKB";

export const searchDesignKBLocal = createTool({
  id: "searchDesignKBLocal",
  description:
    "Fallback local design KB search (no vector DB). Returns a combined relevantContext string plus lightweight sources. Use when vector search is unavailable or returns empty.",
  inputSchema: z.object({
    queryText: z.string().min(1),
    maxChars: z.number().int().min(500).max(12000).default(6000),
  }),
  outputSchema: z.object({
    relevantContext: z.string(),
    sources: z.array(
      z.object({
        docPath: z.string(),
        score: z.number(),
        excerpt: z.string(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    const { queryText, maxChars } = context;
    const q = queryText.toLowerCase();
    const terms = q
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .slice(0, 30);

    const files = await loadDesignKBFiles();

    const scored: Array<{ docPath: string; score: number; content: string }> =
      [];
    for (const f of files) {
      const lower = f.content.toLowerCase();
      let score = 0;
      for (const t of terms) {
        const idx = lower.indexOf(t);
        if (idx >= 0) score += 3;
      }
      if (score > 0) scored.push({ docPath: f.path, score, content: f.content });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);

    const sources: Array<{ docPath: string; score: number; excerpt: string }> =
      [];
    const parts: string[] = [];

    for (const t of top) {
      const lower = t.content.toLowerCase();
      const firstIdx = terms.length ? lower.indexOf(terms[0]!) : -1;
      const start = Math.max(0, firstIdx >= 0 ? firstIdx - 200 : 0);
      const end = Math.min(t.content.length, start + 1400);
      const excerpt = t.content.slice(start, end).trim();

      sources.push({ docPath: t.docPath, score: t.score, excerpt });
      parts.push(`SOURCE: ${t.docPath}\n${excerpt}`.trim());
    }

    const relevantContext = parts.join("\n\n---\n\n").slice(0, maxChars);

    return { relevantContext, sources };
  },
});


