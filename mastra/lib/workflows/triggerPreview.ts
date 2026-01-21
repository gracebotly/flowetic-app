
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

  const run = await workflow.createRunAsync();

  const result = await run.start({
    inputData: {
      tenantId: params.tenantId,
      threadId: params.threadId,
      schemaName: params.schemaName,
      selectedStoryboardKey: params.selectedStoryboardKey,
      selectedStyleBundleId: params.selectedStyleBundleId,
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
