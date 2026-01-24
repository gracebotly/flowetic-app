
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

    const { mastra } = await import("../../index");
    const workflow = mastra.getWorkflow("generatePreview");
    
    if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");

    const { RequestContext } = await import("@mastra/core/request-context");
    const requestContext = new RequestContext();
    requestContext.set("tenantId", tenantId);
    requestContext.set("userId", userId);
    requestContext.set("interfaceId", interfaceId);

    // The workflow API doesn't support direct execution like this.
    // Return an error to disable this tool for now:
    throw new Error("WORKFLOW_EXECUTION_NOT_SUPPORTED: The generatePreview workflow cannot be executed directly. Use the agent workflow tools instead.");
  },
});
