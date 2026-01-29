

import { Memory } from "@mastra/memory";
import { getMastraStorage } from "./storage";
import { PgVector } from "@mastra/pg";
import { openai } from "@ai-sdk/openai";

type CreateFloweticMemoryOpts = {
  lastMessages?: number;
  workingMemory?: { enabled: boolean; template?: string };
};

function envFlag(name: string, defaultValue: boolean) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * IMPORTANT:
 * - semanticRecall requires BOTH: vector store + embedder
 * - Vercel build will instantiate agents; so this must never throw at import-time.
 * - Default: semantic recall OFF unless explicitly enabled and configured.
 */
export function createFloweticMemory(opts: CreateFloweticMemoryOpts = {}) {
  const storage = getMastraStorage();

  const lastMessages = opts.lastMessages ?? 30;
  const workingMemory = opts.workingMemory ?? { enabled: true };

  const semanticRecallEnabled = envFlag("MASTRA_SEMANTIC_RECALL_ENABLED", false);

  // If enabled but missing env, hard-disable (do not throw) to avoid Vercel build failures.
  const connectionString = String(process.env.DATABASE_URL || "").trim();

  if (!semanticRecallEnabled) {
    return new Memory({
      storage,
      options: {
        lastMessages,
        workingMemory: workingMemory as any,
      },
    });
  }

  // We require DB + pgvector. You already use PgVector elsewhere.
  if (!connectionString) {
    return new Memory({
      storage,
      options: {
        lastMessages,
        workingMemory: workingMemory as any,
      },
    });
  }

  const indexName =
    String(process.env.MASTRA_MEMORY_VECTOR_INDEX_NAME || "mastra_memory").trim() ||
    "mastra_memory";

  const vector = new PgVector({
    connectionString,
    id: "flowetic-memory-vector",
  });

  return new Memory({
    storage,
    vector,
    embedder: openai.textEmbeddingModel("text-embedding-3-small"),
    options: {
      lastMessages,
      workingMemory: workingMemory as any,
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: "resource",
        indexName,
      } as any,
    },
  });
}

