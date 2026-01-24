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
        userId: z.string(),
        threadId: z.string(),
        previewVersionId: z.string(),
        confirmed: z.boolean(),
      }),
      outputSchema: z.object({
        interfaceId: z.string().min(1),
        spec_json: z.record(z.any()),
        design_tokens: z.record(z.any()),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        previewVersionId: z.string(),
        confirmed: z.boolean(),
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!getPreviewVersionSpec.execute) {
          throw new Error("getPreviewVersionSpec.execute is not available");
        }
        
        const pv = await getPreviewVersionSpec.execute(
          { tenantId: inputData.tenantId, previewVersionId: inputData.previewVersionId },
          { requestContext }
        );

        if (!validateSpec.execute) {
          throw new Error("validateSpec.execute is not available");
        }
        
        const v = await validateSpec.execute(
          { spec_json: pv.spec_json },
          { requestContext }
        );

        // ← ADD TYPE NARROWING
        if ('message' in v) {
          throw new Error(`VALIDATION_ERROR: ${v.message}`);
        }

        if (!v.valid || v.score < 0.8) {
          throw new Error("DEPLOY_SPEC_VALIDATION_FAILED");
        }

        const unwrapped = unwrapToolResult(pv);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
          previewVersionId: inputData.previewVersionId,
          confirmed: inputData.confirmed,
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
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData }) => {
        if (!inputData.confirmed) throw new Error("DEPLOY_CONFIRMATION_REQUIRED");
        return { 
          ok: true,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
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
        ok: z.boolean(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({
        deploymentId: z.string().min(1),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!createDeploymentRecord.execute) {
          throw new Error("createDeploymentRecord.execute is not available");
        }
        
        const result = await createDeploymentRecord.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            previewVersionId: inputData.previewVersionId
          },
          { requestContext }
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
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
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!markPreviousDeploymentsInactive.execute) {
          throw new Error("markPreviousDeploymentsInactive.execute is not available");
        }
        
        const result = await markPreviousDeploymentsInactive.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            keepDeploymentId: inputData.deploymentId
          },
          { requestContext }
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          deploymentId: inputData.deploymentId,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
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
        ok: z.boolean(),
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!setInterfacePublished.execute) {
          throw new Error("setInterfacePublished.execute is not available");
        }
        
        const result = await setInterfacePublished.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            previewVersionId: inputData.previewVersionId
          },
          { requestContext }
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          deploymentId: inputData.deploymentId,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
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
        ok: z.boolean(),
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
        deployedUrl: z.string()
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!generatePortalUrl?.execute) {
          throw new Error('generatePortalUrl tool not found');
        }

        const result = await generatePortalUrl.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            deploymentId: inputData.deploymentId
          },
          { requestContext }
        );

        // Handle validation errors
        if ('error' in result) {
          return {
            deploymentId: inputData.deploymentId,
            tenantId: inputData.tenantId,
            userId: inputData.userId,
            threadId: inputData.threadId,
            interfaceId: inputData.interfaceId,
            previewVersionId: inputData.previewVersionId,
            deployedUrl: ''
          };
        }

        return {
          deploymentId: inputData.deploymentId,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
          deployedUrl: result.deployedUrl
        };
      },
    }),
  )
  .then(
    createStep({
      id: "logDeploymentEventStep",
      description: "Append thread event for deployment success.",
      inputSchema: z.object({
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
        deployedUrl: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
        deployedUrl: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        if (!appendThreadEvent?.execute) {
          throw new Error('appendThreadEvent tool not found');
        }

        await appendThreadEvent.execute(
          {
            tenantId: inputData.tenantId,
            threadId: inputData.threadId,
            type: "state",
            message: "Deployment initiated",
            metadata: {
              kind: "deployDashboard",
              interfaceId: inputData.interfaceId,
            }
          },
          { requestContext }
        );

        if (!setJourneyDeployed?.execute) {
          throw new Error('setJourneyDeployed tool not found');
        }

        const result = await setJourneyDeployed.execute(
          {
            tenantId: inputData.tenantId,
            interfaceId: inputData.interfaceId,
            deploymentId: inputData.deploymentId,
            previewVersionId: inputData.previewVersionId
          },
          { requestContext }
        );

        return {
          ok: 'ok' in result ? result.ok : true,
          deploymentId: inputData.deploymentId,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId,
          deployedUrl: inputData.deployedUrl
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
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string()
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
              todoId: "deploy"
            },
            { requestContext }
          );
          unwrapToolResult(result);
        } catch {
          // ignore
        }
        return {
          ok: inputData.ok ?? true,
          deploymentId: inputData.deploymentId,
          deployedUrl: inputData.deployedUrl,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId
        };
      },
    }),
  )
  .then(
    createStep({
      id: "secondAppendThreadEventStep",
      description: "Append final thread event for deployment completion.",
      inputSchema: z.object({
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string()
      }),
      outputSchema: z.object({ 
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string()
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
              todoId: "deploy"
            },
            { requestContext }
          );
          unwrapToolResult(result);
        } catch {
          // ignore
        }
        return {
          ok: inputData.ok ?? true,
          deploymentId: inputData.deploymentId,
          deployedUrl: inputData.deployedUrl,
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          threadId: inputData.threadId,
          interfaceId: inputData.interfaceId,
          previewVersionId: inputData.previewVersionId
        };
      },
    }),
  )
  .then(
    createStep({
      id: "finalize",
      description: "Finalize deploy output.",
      inputSchema: z.object({
        ok: z.boolean(),
        deploymentId: z.string(),
        deployedUrl: z.string(),
        tenantId: z.string(),
        userId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string()
      }),
      outputSchema: z.object({
        deploymentId: z.string(),
        deployedUrl: z.string(),
        status: z.string(),
      }),
      execute: async ({ inputData }) => {
        return { 
          deploymentId: inputData.deploymentId,
          deployedUrl: inputData.deployedUrl,
          status: "published" 
        };
      },
    }),
  )
  .commit();
