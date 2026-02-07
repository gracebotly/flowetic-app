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
  const workflow = mastra.getWorkflow("generatePreview");
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");

  const requestContext = new RequestContext();
  requestContext.set("tenantId", params.tenantId);
  requestContext.set("threadId", params.threadId);

  try {
    // FIX 3: Use unique runId to prevent snapshot collisions
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
    throw new Error(`WORKFLOW_FAILED: ${error}`);
  }
}
