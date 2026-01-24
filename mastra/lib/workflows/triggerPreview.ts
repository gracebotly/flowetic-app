
import { mastra } from "../../index";
import { RequestContext } from "@mastra/core/request-context";

export async function triggerGeneratePreview(params: {
  tenantId: string;
  threadId: string;
  schemaName: string;
  selectedStoryboardKey: string;
  selectedStyleBundleId: string;
}) {
  const workflow = mastra.getWorkflow("generatePreview");
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");

  const requestContext = new RequestContext();
  requestContext.set("tenantId", params.tenantId);
  requestContext.set("threadId", params.threadId);
  requestContext.set("schemaName", params.schemaName);
  requestContext.set("selectedStoryboardKey", params.selectedStoryboardKey);
  requestContext.set("selectedStyleBundleId", params.selectedStyleBundleId);

  // FIXED: Use workflow.run() directly instead of createRunAsync()
  const result = await workflow.run({
    inputData: {
      tenantId: params.tenantId,
      userId: params.tenantId, // Using tenantId as userId for now
      userRole: "admin" as const,
      interfaceId: params.schemaName,
      instructions: undefined,
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
