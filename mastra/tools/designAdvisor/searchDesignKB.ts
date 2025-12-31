

import { createVectorQueryTool } from "@mastra/rag";
import { openai } from "@ai-sdk/openai";

/**
 * RAG tool for GetFlowetic Design Advisor.
 *
 * Notes:
 * - vectorStoreName/indexName can be overridden via RuntimeContext if you later wire it.
 * - Keep defaults stable and configurable via env for prod.
 */
export const searchDesignKB = createVectorQueryTool({
  id: "searchDesignKB",
  description:
    "Search GetFlowetic's internal UI/UX + design-system knowledge base. Use this to ground design advice (colors, typography, spacing, layout patterns).",
  vectorStoreName: process.env.MASTRA_VECTOR_STORE_NAME || "pgVector",
  indexName: process.env.MASTRA_DESIGN_KB_INDEX_NAME || "design_kb",
  model: openai.embedding("text-embedding-3-small"),
  enableFilter: true,
  includeSources: true,
  databaseConfig: {
    pgvector: {
      minScore: 0.72,
      ef: 200,
      probes: 10,
    },
  },
});

