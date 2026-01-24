
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { mastra } from "../../index";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description: "Triggers the generate preview workflow to create a dashboard preview",
  inputSchema: z.object({
    tenantId: z.string().uuid().describe("The tenant ID"),
    userId: z.string().uuid().describe("The user ID"),
    interfaceId: z.string().uuid().describe("The interface ID"),
    userRole: z.enum(["admin", "client", "viewer"]).describe("The user role"),
    instructions: z.string().optional().describe("Optional instructions"),
  }),
  outputSchema: z.object({
    runId: z.string().uuid().describe("The workflow run ID"),
    previewVersionId: z.string().uuid().describe("The preview version ID"),
    previewUrl: z.string().url().describe("The preview URL"),
  }),
  execute: async (inputData, context) => {
    const { tenantId, userId, interfaceId, userRole, instructions } = inputData;

    // Get the workflow from mastra instance
    const workflow = mastra.getWorkflow("generatePreview");
    if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");

    // Use RequestContext for workflow execution
    const { RequestContext } = await import("@mastra/core/request-context");
    const requestContext = new RequestContext();
    requestContext.set("tenantId", tenantId);
    requestContext.set("userId", userId);
    requestContext.set("interfaceId", interfaceId);

    // Check if workflow has execute() method - the direct way to run workflows
    if (typeof workflow.execute === "function") {
      const result = await workflow.execute({
        inputData: {
          tenantId,
          userId,
          userRole,
          interfaceId,
          instructions,
        },
        requestContext,
      });

      if (result.status !== "success") {
        throw new Error(`WORKFLOW_FAILED: ${result.status}`);
      }

      return {
        runId: result.result.runId,
        previewVersionId: result.result.previewVersionId,
        previewUrl: result.result.previewUrl,
      };
    }

    // Fallback: If execute doesn't exist, this workflow needs to be called differently
    // For now, return a structured error to indicate what's needed
    throw new Error("WORKFLOW_EXECUTION_UNSUPPORTED: The workflow API has changed. Please use direct tool calls instead of workflow.run() or workflow.execute().");
  },
});
