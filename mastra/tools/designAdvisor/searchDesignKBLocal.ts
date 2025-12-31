


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";


const InputSchema = z.object({
  queryText: z.string().min(1),
  maxChars: z.number().int().min(500).max(12000).default(6000),
  rootDir: z.string().optional(),
});


const OutputSchema = z.object({
  relevantContext: z.string(),
  sources: z.array(
    z.object({
      docPath: z.string(),
      score: z.number(),
      excerpt: z.string(),
    }),
  ),
});


async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      out.push(...(await listFiles(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}


function isTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return [".md", ".txt", ".json", ".yaml", ".yml"].includes(ext);
}


function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 30);
}


function scoreText(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx >= 0) score += 3;
  }
  // bonus for common design terms if present
  const bonuses = ["typography", "spacing", "contrast", "grid", "layout", "color", "tokens", "premium"];
  for (const b of bonuses) if (lower.includes(b)) score += 1;
  return score;
}


function excerptAround(text: string, terms: string[], maxLen: number) {
  const lower = text.toLowerCase();
  let bestIdx = -1;
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx >= 0) {
      bestIdx = idx;
      break;
    }
  }
  if (bestIdx < 0) {
    return text.slice(0, maxLen);
  }
  const start = Math.max(0, bestIdx - Math.floor(maxLen / 3));
  const end = Math.min(text.length, start + maxLen);
  return text.slice(start, end);
}


export const searchDesignKBLocal = createTool({
  id: "searchDesignKBLocal",
  description:
    "Fallback local design knowledge search (no vector DB). Reads markdown/text from vendor/ui-ux-pro-max-skill and returns the most relevant excerpts. Use when pgvector is not available.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async ({ context }) => {
    const root =
      context.rootDir ||
      process.env.DESIGN_KB_ROOT ||
      path.join(process.cwd(), "vendor", "ui-ux-pro-max-skill");


    const terms = tokenize(context.queryText);
    const files = (await listFiles(root)).filter(isTextFile);


    const scored: Array<{ docPath: string; score: number; text: string }> = [];
    for (const filePath of files) {
      const raw = await fs.readFile(filePath, "utf8").catch(() => "");
      if (!raw) continue;
      const s = scoreText(raw, terms);
      if (s > 0) {
        scored.push({
          docPath: path.relative(root, filePath).replaceAll("\\", "/"),
          score: s,
          text: raw,
        });
      }
    }


    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);


    const maxChars = context.maxChars;
    const parts: string[] = [];
    const sources: Array<{ docPath: string; score: number; excerpt: string }> = [];


    for (const t of top) {
      const ex = excerptAround(t.text, terms, Math.min(1400, Math.floor(maxChars / 3)));
      sources.push({ docPath: t.docPath, score: t.score, excerpt: ex });
      parts.push(`SOURCE: ${t.docPath}\n${ex}`.trim());
    }


    const relevantContext = parts.join("\n\n---\n\n").slice(0, maxChars);


    return {
      relevantContext,
      sources,
    };
  },
});


