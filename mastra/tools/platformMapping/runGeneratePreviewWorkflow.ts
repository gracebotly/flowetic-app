









import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { generatePreviewWorkflow } from "../../workflows/generatePreview";
import { RuntimeContext } from "../../core/RuntimeContext";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description: "Run the Generate Preview workflow end-to-end using the existing runtimeContext.",
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

    // Ensure runtimeContext is the correct class (defensive, but no guessing)
    const rc = runtimeContext as RuntimeContext;

    const result = await generatePreviewWorkflow.start({
      inputData: {
        tenantId: context.tenantId,
        userId: context.userId,
        userRole: context.userRole,
        interfaceId: context.interfaceId,
        instructions: context.instructions,
      },
      runtimeContext: runtimeContext as RuntimeContext,
    });


    // In Mastra, generatePreviewWorkflow.start returns a result envelope; your workflow's output schema
    // is the final output, available on result.result when status === 'success'.
    if (result.status !== "success") {
      throw new Error("WORKFLOW_FAILED");
    }


    return {
      runId: result.runId, // runId is stored in the result
      previewVersionId: result.result.previewVersionId,
      previewUrl: result.result.previewUrl,
    };
  },
});








