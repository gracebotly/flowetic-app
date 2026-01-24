

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

  try {
    const result = await workflow.execute({
    tenantId: params.tenantId,
    userId: params.tenantId, // Using tenantId as userId for now
    userRole: 'admin' as const,
    interfaceId: params.schemaName, // schemaName maps to interfaceId
    requestContext: requestContext,
  });

    // The workflow returns the result directly (not wrapped in a status object)
    return {
      runId: result.runId,
      previewVersionId: result.previewVersionId,
      previewUrl: result.previewUrl,
    };
  } catch (error) {
    throw new Error(`WORKFLOW_FAILED: ${error}`);
  }
}

