

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
 * IMPORTANT: Memory configuration for autonomous agent behavior
 * - semanticRecall requires BOTH: vector store + embedder
 * - Vercel build will instantiate agents; so this must never throw at import-time.
 * - Default: semantic recall ENABLED for autonomous behavior (changed from false to true)
 */
export function createFloweticMemory(opts: CreateFloweticMemoryOpts = {}) {
  const storage = getMastraStorage();
  const lastMessages = opts.lastMessages ?? 30;
  const workingMemory =
    opts.workingMemory ??
    ({
      enabled: true,
      template: `# Vibe Journey State - <working_memory>

## Current Phase
- Phase: {{phase}}
- Last Updated: {{timestamp}}

## Workflow Context
- Platform: {{platformType}}
- Workflow Name: {{workflowName}}

## Notes
(Record user selections, progress, and decisions here as the journey proceeds)
`,
    } as const);
  
  // Enable semantic recall by default for autonomous behavior
  const semanticRecallEnabled = envFlag("MASTRA_SEMANTIC_RECALL_ENABLED", true);
  
  // We require DB + pgvector. You already use PgVector elsewhere.
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  
  // If semantic recall is disabled, return basic memory
  if (!semanticRecallEnabled) {
    console.log('[FloweticMemory] Semantic recall DISABLED - using message history + working memory only');
    return new Memory({
      storage,
      options: {
        lastMessages,
        workingMemory: workingMemory as any,
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
        workingMemory: workingMemory as any,
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
      workingMemory: workingMemory as any,
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

