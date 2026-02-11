// mastra/lib/workflows/triggerPreview.ts
import { mastra } from "../../index";
import { RequestContext } from "@mastra/core/request-context";
import { randomUUID } from "crypto";

export async function triggerGeneratePreview(params: {
  tenantId: string;
  threadId: string;
  schemaName: string;
  selectedStoryboardKey: string;
  selectedStyleBundleId: string;
}) {
  // Use the singleton - NEVER dynamic import
  const workflow = mastra.getWorkflow("generatePreviewWorkflow");
  if (!workflow) {
    console.error("[triggerGeneratePreview] Available workflows:", 
      Object.keys((mastra as any).workflows || {}));
    throw new Error("WORKFLOW_NOT_FOUND: generatePreviewWorkflow not registered");
  }

  const requestContext = new RequestContext();
  requestContext.set("tenantId", params.tenantId);
  requestContext.set("threadId", params.threadId);

  try {
    // Use unique runId to prevent snapshot collisions
    const run = await workflow.createRun({ runId: randomUUID() });

    const result = await run.start({
      inputData: {
        tenantId: params.tenantId,
        userId: params.tenantId, // Using tenantId as userId for now
        userRole: 'admin' as const,
        interfaceId: params.schemaName,
        instructions: "",
      },
      requestContext,
    });

    if (result.status === 'failed') {
      throw new Error(`Workflow execution failed: ${result.error?.message || 'Unknown error'}`);
    }

    if (result.status === 'suspended') {
      throw new Error('Workflow execution suspended - requires manual intervention');
    }

    if (result.status !== 'success') {
      throw new Error(`Workflow execution returned unexpected status: ${result.status}`);
    }

    const output = result.result;

    return {
      runId: output.runId || '',
      previewVersionId: output.previewVersionId || '',
      previewUrl: output.previewUrl || '',
    };
  } catch (error) {
    console.error("[triggerGeneratePreview] Error:", error);
    throw new Error(`WORKFLOW_FAILED: ${error}`);
  }
}
