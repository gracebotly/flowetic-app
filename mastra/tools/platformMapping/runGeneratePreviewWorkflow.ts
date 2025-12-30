









import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { RuntimeContext } from "@/mastra/core/RuntimeContext";
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
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("tenantId", context.tenantId);
    runtimeContext.set("userId", context.userId);
    runtimeContext.set("userRole", context.userRole);
    runtimeContext.set("interfaceId", context.interfaceId);
    runtimeContext.set("threadId", context.threadId);
    runtimeContext.set("platformType", context.platformType);
    runtimeContext.set("sourceId", context.sourceId);

    const result = await generatePreviewWorkflow.execute({
      inputData: {
        tenantId: context.tenantId,
        userId: context.userId,
        userRole: context.userRole,
        interfaceId: context.interfaceId,
        instructions: context.instructions,
      },
      runtimeContext,
    });

    return {
      runId: result.runId,
      previewVersionId: result.previewVersionId,
      previewUrl: result.previewUrl,
    };
  },
});








