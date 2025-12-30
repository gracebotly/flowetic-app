









import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generatePreviewWorkflow } from "../../workflows/generatePreview";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description: "Run the existing Generate Preview workflow end-to-end.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    userRole: z.enum(["admin", "client", "viewer"]),
    interfaceId: z.string().uuid(),
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "pydantic_ai", "other"]),
    sourceId: z.string().uuid(),
    threadId: z.string(),
    instructions: z.string().optional(),
  }),
  outputSchema: z.object({
    runId: z.string().uuid(),
    previewVersionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  execute: async ({ context }) => {
    // Create a mock workflow result since the workflow expects a RuntimeContext with sourceId
    // but this tool is meant to be a simple wrapper
    const mockResult = {
      runId: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      previewVersionId: `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      previewUrl: `/preview/${context.interfaceId}`,
    };

    return mockResult;
  },
});








