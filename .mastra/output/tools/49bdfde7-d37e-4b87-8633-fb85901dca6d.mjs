import { createVectorQueryTool } from '@mastra/rag';
import { openai } from '@ai-sdk/openai';

const searchDesignKB = createVectorQueryTool({
  id: "searchDesignKB",
  description: "Search GetFlowetic's UI/UX design knowledge base (ui-ux-pro-max-skill + internal rules). Use this to ground design advice and reduce hallucinations.",
  vectorStoreName: process.env.MASTRA_VECTOR_STORE_NAME || "pgVector",
  indexName: process.env.MASTRA_DESIGN_KB_INDEX_NAME || "design_kb",
  model: openai.embedding("text-embedding-3-small"),
  enableFilter: true
});

export { searchDesignKB };
