
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { validateSpec } from "../tools/validateSpec";
import { appendThreadEvent } from "../tools/platformMapping/appendThreadEvent";
import { todoComplete } from "../tools/todo/todoComplete";

import { getPreviewVersionSpec } from "../tools/deploy/getPreviewVersionSpec";
import { createDeploymentRecord } from "../tools/deploy/createDeploymentRecord";
import { markPreviousDeploymentsInactive } from "../tools/deploy/markPreviousDeploymentsInactive";
import { setInterfacePublished } from "../tools/deploy/setInterfacePublished";
import { generatePortalUrl } from "../tools/deploy/generatePortalUrl";
import { setJourneyDeployed } from "../tools/deploy/setJourneyDeployed";

// Type guard for handling tool execution errors
type ValidationErrorLike = {
  code?: string;
  path?: string | string[];
  message: string;
};

function isValidationErrorLike(error: unknown): error is ValidationErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ValidationErrorLike).message === "string"
  );
}

// Helper to unwrap tool results and handle ValidationErrors properly
function unwrapToolResult<T>(result: T): T {
  if (isValidationErrorLike(result)) {
    throw new Error(`VALIDATION_ERROR: ${result.message}`);
  }
  return result;
}

export const deployDashboardWorkflow = createWorkflow({
  id: "deployDashboard",
  description:
    "Deploy a preview dashboard version to the client portal with validation, confirmation gating, deployment versioning, and audit events.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    userId: z.string().min(1),
    threadId: z.string().min(1),
    previewVersionId: z.string().min(1),
    confirmed: z.boolean(),
  }),
  outputSchema: z.object({
    deploymentId: z.string().min(1),
    deployedUrl: z.string().min(1),
    status: z.string().min(1),
  }),
})
  .then(
    createStep({
      id: "revalidateSpecStep",
      description: "Load preview spec and re-validate before deploy (hard gate).",
      inputSchema: z.object({
        tenantId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({
        interfaceId: z.string().min(1),
        spec_json: z.record(z.any()),
        design_tokens: z.record(z.any()),
        tenantId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const pv = await getPreviewVersionSpec.execute(
          { tenantId: inputData.tenantId, previewVersionId: inputData.previewVersionId },
          new RuntimeContext()
        );

        const v = await validateSpec.execute(
          { spec_json: pv.spec_json },
          new RuntimeContext()
        );

        if (!v.valid || v.score < 0.8) {
          throw new Error("DEPLOY_SPEC_VALIDATION_FAILED");
        }

        const unwrapped = unwrapToolResult(pv);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "checkUserConfirmationStep",
      description: "Verify user confirmation (HITL gate).",
      inputSchema: z.object({
        confirmed: z.boolean(),
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData }) => {
        if (!inputData.confirmed) throw new Error("DEPLOY_CONFIRMATION_REQUIRED");
        return { 
          ok: true,
          tenantId: inputData.tenantId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "createDeploymentRecordStep",
      description: "Create deployment record in Supabase.",
      inputSchema: z.object({
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({
        deploymentId: z.string().min(1),
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await createDeploymentRecord.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            previewVersionId: inputData.previewVersionId
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "markPreviousInactiveStep",
      description: "Mark previous deployments inactive for this interface.",
      inputSchema: z.object({
        tenantId: z.string(),
        interfaceId: z.string(),
        keepDeploymentId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await markPreviousDeploymentsInactive.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            keepDeploymentId: inputData.keepDeploymentId
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "updateInterfaceStatusStep",
      description: "Set interface status to published and active version pointer.",
      inputSchema: z.object({
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await setInterfacePublished.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            previewVersionId: inputData.previewVersionId
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "generatePortalUrlStep",
      description: "Generate portal URL for deployed dashboard.",
      inputSchema: z.object({
        tenantId: z.string(),
        interfaceId: z.string(),
        deploymentId: z.string(),
      }),
      outputSchema: z.object({
        deployedUrl: z.string().min(1),
        tenantId: z.string(),
        interfaceId: z.string(),
        deploymentId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await generatePortalUrl.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            deploymentId: inputData.deploymentId
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          interfaceId: inputData.interfaceId,
          deploymentId: inputData.deploymentId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "logDeploymentEventStep",
      description: "Append thread event for deployment success.",
      inputSchema: z.object({
        tenantId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        tenantId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await appendThreadEvent.execute(
          {
            tenantId: inputData.tenantId,
            threadId: inputData.threadId,
            // userId and role removed - not in appendThreadEvent schema
            type: "state",
            message: `Deployed successfully. Portal URL ready.`,
            metadata: {
              deploymentId: inputData.deploymentId,
              deployedUrl: inputData.deployedUrl,
            }
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ok: true,
          tenantId: inputData.tenantId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
          deploymentId: inputData.deploymentId,
          deployedUrl: inputData.deployedUrl,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "updateJourneySessionPointersStep",
      description:
        "Write deployed pointers back to journey_sessions (keep schema the same).",
      inputSchema: z.object({
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
        tenantId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!setJourneyDeployed?.execute) {
          throw new Error('setJourneyDeployed tool not found');
        }
        
        const result = await setJourneyDeployed.execute(
          {
            tenantId: inputData.tenantId,
            threadId: inputData.threadId,
            interfaceId: inputData.interfaceId,
            previewVersionId: inputData.previewVersionId
          },
          { runtimeContext: requestContext }
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ok: unwrapped?.ok ?? true,
          deploymentId: unwrapped?.deploymentId ?? '',
          deployedUrl: unwrapped?.deployedUrl ?? ''
        };
      },
    }),
  )
  .then(
    createStep({
      id: "completeTodosStep",
      description: "Complete deploy-related todos (best-effort).",
      inputSchema: z.object({
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
        tenantId: z.string(),
        threadId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        // Best-effort: if you don't have a specific deploy todo id yet, skip silently.
        // This keeps workflow safe while preserving V2 step slot.
        try {
          if (!todoComplete?.execute) {
            throw new Error('todoComplete tool not found');
          }
          
          const result = await todoComplete.execute(
            {
              tenantId: inputData.tenantId,
              threadId: inputData.threadId,
              todoId: "deploy" // placeholder convention; update later when you have real todo ids
            },
            { runtimeContext: requestContext }
          );
          unwrapToolResult(result);
        } catch {
          // ignore
        }
        return {
          ok: inputData.ok ?? true,
          deploymentId: inputData.deploymentId ?? '',
          deployedUrl: inputData.deployedUrl ?? ''
        };
      },
    }),
  )
  .then(
    createStep({
      id: "finalize",
      description: "Finalize deploy output.",
      inputSchema: z.object({
        deploymentId: z.string(),
        deployedUrl: z.string(),
      }),
      outputSchema: z.object({
        deploymentId: z.string(),
        deployedUrl: z.string(),
        status: z.string(),
      }),
      execute: async ({ inputData }) => {
        return { ...inputData, status: "published" };
      },
    }),
  )
  .commit();
