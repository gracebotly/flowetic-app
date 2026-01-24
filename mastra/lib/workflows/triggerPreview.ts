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
    // Mastra v1.0: Use createRun() + start() instead of trigger()
    const run = await workflow.createRun();
    
    const result = await run.start({
      inputData: {
        tenantId: params.tenantId,
        userId: params.tenantId, // Using tenantId as userId for now
        userRole: 'admin' as const,
        interfaceId: params.schemaName, // schemaName maps to interfaceId
        instructions: "",
      },
    });

    // Check workflow execution status
    if (result.status === 'failed') {
      throw new Error(`Workflow execution failed: ${result.error?.message || 'Unknown error'}`);
    }
    
    if (result.status === 'suspended') {
      throw new Error('Workflow execution suspended - requires manual intervention');
    }

    if (result.status !== 'success') {
      throw new Error(`Workflow execution returned unexpected status: ${result.status}`);
    }

    // Extract result from successful execution
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
