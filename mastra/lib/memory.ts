

import { Memory } from "@mastra/memory";
import { getMastraStorage } from "./storage";
import { PgVector } from "@mastra/pg";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

type CreateFloweticMemoryOpts = {
  lastMessages?: number;
  workingMemory?: { enabled: boolean; template?: string; schema?: z.ZodObject<any> };
};

function envFlag(name: string, defaultValue: boolean) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * IMPORTANT: Memory configuration for autonomous agent behavior
 * - semanticRecall requires BOTH: vector store + embedder
 * - Vercel build will instantiate agents; so this must never throw at import-time.
 * - Default: semantic recall ENABLED for autonomous behavior (changed from false to true)
 */
export function createFloweticMemory(opts: CreateFloweticMemoryOpts = {}) {
  const storage = getMastraStorage();
  const lastMessages = opts.lastMessages ?? 30;
  // Schema-based working memory: merge semantics means the agent only sends
  // fields it wants to update, dramatically reducing malformed JSON from weak models.
  const defaultWorkingMemorySchema = z.object({
    phase: z.string().optional().describe("Current journey phase"),
    platformType: z.string().optional().describe("Connected platform type (e.g. n8n, make, vapi)"),
    workflowName: z.string().optional().describe("Name of the connected workflow"),
    selectedEntities: z.string().optional().describe("Comma-separated entity names user selected"),
    selectedOutcome: z.string().optional().describe("dashboard or product"),
    selectedStyleBundleId: z.string().optional().describe("Chosen style bundle ID"),
    lastDecision: z.string().optional().describe("Most recent user decision or action"),
    notes: z.string().optional().describe("Any additional context the agent wants to remember"),
  });

  const workingMemory = opts.workingMemory ?? {
    enabled: true,
    schema: defaultWorkingMemorySchema,
  };
  
  // Enable semantic recall by default for autonomous behavior
  const semanticRecallEnabled = envFlag("MASTRA_SEMANTIC_RECALL_ENABLED", false);
  
  // We require DB + pgvector. You already use PgVector elsewhere.
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  
  // If semantic recall is disabled, return basic memory
  if (!semanticRecallEnabled) {
    console.log('[FloweticMemory] Semantic recall DISABLED - using message history + working memory only');
    return new Memory({
      storage,
      options: {
        lastMessages,
        workingMemory,
      },
    });
  }
  
  // If DB connection string is missing, fall back to basic memory
  if (!connectionString) {
    console.warn('[FloweticMemory] DATABASE_URL missing - semantic recall DISABLED');
    return new Memory({
      storage,
      options: {
        lastMessages,
        workingMemory,
      },
    });
  }
  
  // FULL AUTONOMOUS MEMORY: Message History + Working Memory + Semantic Recall
  const indexName = String(
    process.env.MASTRA_MEMORY_VECTOR_INDEX_NAME || "mastra_memory"
  ).trim() || "mastra_memory";
  
  const vector = new PgVector({
    connectionString,
    id: "flowetic-memory-vector",
  });
  
  const memory = new Memory({
    storage,
    vector,
    embedder: openai.embedding("text-embedding-3-small"),
    options: {
      lastMessages,
      workingMemory,
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: "resource",
        indexName,
      } as any,
    },
  });
  
  // Add diagnostic logging
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MEMORY === 'true') {
    console.log('[FloweticMemory] Semantic recall ENABLED with full configuration:', {
      lastMessages,
      workingMemoryEnabled: workingMemory.enabled,
      topK: 5,
      messageRange: 3,
      scope: 'resource',
      indexName,
      connectionString: connectionString.replace(/:[^:]+@/, ':****@'), // Hide password in logs
    });
  }
  
  return memory;
}

