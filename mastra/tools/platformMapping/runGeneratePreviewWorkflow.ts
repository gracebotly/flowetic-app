import { createTool } from "@mastra/core/tools";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";
import { generatePreviewWorkflow } from "../../workflows/generatePreview";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description:
    "Run the Generate Preview workflow end-to-end using the existing runtimeContext.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    userRole: z.enum(["admin", "client", "viewer"]),
    interfaceId: z.string().uuid(),
    instructions: z.string().optional(),
  }),
  outputSchema: z.object({
    runId: z.string().uuid(),
    previewVersionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    if (!runtimeContext) {
      // Hard fail: per architecture, runtimeContext is required on every call
      throw new Error("RUNTIME_CONTEXT_REQUIRED");
    }

    const result = await generatePreviewWorkflow.execute({
      inputData: {
        tenantId: context.tenantId,
        userId: context.userId,
        userRole: context.userRole,
        interfaceId: context.interfaceId,
        instructions: context.instructions,
      },
      runtimeContext: runtimeContext as RuntimeContext,
    });

    return {
      runId: result.runId,
      previewVersionId: result.previewVersionId,
      previewUrl: result.previewUrl,
    };
  },
});
