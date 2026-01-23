
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
      }),
      execute: async ({ inputData, requestContext }) => {
        const pv = await getPreviewVersionSpec.execute(inputData, {
          requestContext,
        } as any);

        const v = await validateSpec.execute(
          { spec_json: pv.spec_json } as any,
          { requestContext } as any,
        );

        if (!v.valid || v.score < 0.8) {
          throw new Error("DEPLOY_SPEC_VALIDATION_FAILED");
        }

        return pv;
      },
    }),
  )
  .then(
    createStep({
      id: "checkUserConfirmationStep",
      description: "Verify user confirmation (HITL gate).",
      inputSchema: z.object({
        confirmed: z.boolean(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData }) => {
        if (!inputData.confirmed) throw new Error("DEPLOY_CONFIRMATION_REQUIRED");
        return { ok: true };
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
      }),
      execute: async ({ inputData, requestContext }) => {
        return createDeploymentRecord.execute(inputData, {
          requestContext,
        } as any);
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
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, requestContext }) => {
        return markPreviousDeploymentsInactive.execute(inputData, {
          requestContext,
        } as any);
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
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, requestContext }) => {
        return setInterfacePublished.execute(inputData, {
          requestContext,
        } as any);
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
      }),
      execute: async ({ inputData, requestContext }) => {
        return generatePortalUrl.execute(inputData, { requestContext } as any);
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
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, requestContext }) => {
        await appendThreadEvent.execute(
          {
            tenantId: inputData.tenantId,
            threadId: inputData.threadId,
            interfaceId: inputData.interfaceId,
            runId: null,
            type: "state",
            message: `Deployed successfully. Portal URL ready.`,
            metadata: {
              deploymentId: inputData.deploymentId,
              deployedUrl: inputData.deployedUrl,
            },
          } as any,
          { requestContext } as any,
        );
        return { ok: true };
      },
    }),
  )
  .then(
    createStep({
      id: "updateJourneySessionPointersStep",
      description:
        "Write deployed pointers back to journey_sessions (keep schema the same).",
      inputSchema: z.object({
        tenantId: z.string(),
        threadId: z.string(),
        interfaceId: z.string(),
        previewVersionId: z.string(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, requestContext }) => {
        return setJourneyDeployed.execute(inputData, { requestContext } as any);
      },
    }),
  )
  .then(
    createStep({
      id: "completeTodosStep",
      description: "Complete deploy-related todos (best-effort).",
      inputSchema: z.object({
        tenantId: z.string(),
        threadId: z.string(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, requestContext }) => {
        // Best-effort: if you don't have a specific deploy todo id yet, skip silently.
        // This keeps workflow safe while preserving V2 step slot.
        try {
          await todoComplete.execute(
            {
              tenantId: inputData.tenantId,
              threadId: inputData.threadId,
              todoId: "deploy", // placeholder convention; update later when you have real todo ids
            } as any,
            { requestContext } as any,
          );
        } catch {
          // ignore
        }
        return { ok: true };
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
