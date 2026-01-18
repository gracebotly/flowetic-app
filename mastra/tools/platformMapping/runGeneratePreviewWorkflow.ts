import { createTool } from "@mastra/core/tools";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";
import { generatePreviewWorkflow } from "../../workflows/generatePreview";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description:
    "Run the Generate Preview workflow end-to-end using Mastra workflow runs.",
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
      throw new Error("RUNTIME_CONTEXT_REQUIRED");
    }

    const run = await generatePreviewWorkflow.createRunAsync();

    const result = await run.start({
      inputData: {
        tenantId: context.tenantId,
        userId: context.userId,
        userRole: context.userRole,
        interfaceId: context.interfaceId,
        instructions: context.instructions,
      },
      runtimeContext: runtimeContext as RuntimeContext,
    });

    if (result.status !== "success") {
      throw new Error("WORKFLOW_FAILED");
    }

    return {
      runId: result.result.runId,
      previewVersionId: result.result.previewVersionId,
      previewUrl: result.result.previewUrl,
    };
  },
});
