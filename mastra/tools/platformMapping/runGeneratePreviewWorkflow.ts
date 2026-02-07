// mastra/tools/platformMapping/runGeneratePreviewWorkflow.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { randomUUID } from "crypto";

export const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description:
    "Triggers the generate preview workflow to create a dashboard preview. " +
    "The agent decides when to call this based on journey context.",
  inputSchema: z.object({
    tenantId: z.string().uuid().describe("The tenant ID"),
    userId: z.string().uuid().describe("The user ID"),
    interfaceId: z.string().uuid().describe("The interface ID"),
    userRole: z.enum(["admin", "client", "viewer"]).describe("The user role"),
    instructions: z.string().optional().describe("Optional instructions"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    runId: z.string().optional(),
    previewVersionId: z.string().optional(),
    previewUrl: z.string().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    currentPhase: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const { tenantId, userId, interfaceId, userRole, instructions } = inputData;

    // Phase gate REMOVED — the agent enforces the journey flow via instructions.
    // No need to block here; the agent won't call this workflow until selections are complete.

    // ═══════════════════════════════════════════════════════════
    // FIX: SNAPSHOT COLLISION — Use unique runId + cleanup
    // ═══════════════════════════════════════════════════════════
    try {
      const { mastra } = await import("../../index");
      const workflow = mastra.getWorkflow("generatePreview");

      if (!workflow) {
        return {
          success: false,
          error: "WORKFLOW_NOT_FOUND",
          message: "The preview generation workflow is not registered.",
        };
      }

      // Clean up stale snapshots before creating a new run.
      // This prevents "duplicate key" errors from previous suspended/failed runs.
      try {
        const accessToken = context?.requestContext?.get("supabaseAccessToken") as string;
        if (accessToken) {
          const { createAuthenticatedClient } = await import("../../lib/supabase");
          const supabase = createAuthenticatedClient(accessToken);

          // Delete snapshots older than 1 hour for this workflow
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { error: cleanupErr } = await supabase
            .from("mastra_workflow_snapshot")
            .delete()
            .eq("workflow_name", "generatePreview")
            .lt("created_at", oneHourAgo);

          if (cleanupErr) {
            console.warn("[runGeneratePreviewWorkflow] Snapshot cleanup warning:", cleanupErr.message);
            // Non-fatal — continue anyway
          } else {
            console.log("[runGeneratePreviewWorkflow] Cleaned up stale workflow snapshots.");
          }
        }
      } catch (cleanupErr) {
        console.warn("[runGeneratePreviewWorkflow] Snapshot cleanup failed (non-fatal):", cleanupErr);
      }

      // Create a fresh run with a unique ID
      const run = await workflow.createRun({ runId: randomUUID() });

      // Pass through RequestContext values
      const { RequestContext } = await import("@mastra/core/request-context");
      const requestContext = new RequestContext();

      // Copy all relevant context from the agent's requestContext
      const contextKeys = [
        "tenantId", "userId", "interfaceId", "supabaseAccessToken",
        "sourceId", "platformType", "phase", "threadId",
        "selectedOutcome", "selectedStyleBundleId",
      ];
      for (const key of contextKeys) {
        const val = context?.requestContext?.get(key);
        if (val !== undefined && val !== null) {
          requestContext.set(key, val);
        }
      }
      // Override with input values (they take precedence)
      requestContext.set("tenantId", tenantId);
      requestContext.set("userId", userId);
      requestContext.set("interfaceId", interfaceId);

      const result = await run.start({
        inputData: {
          tenantId,
          userId,
          userRole,
          interfaceId,
          instructions: instructions || "",
        },
        requestContext,
      });

      if (result.status === "failed") {
        return {
          success: false,
          error: "WORKFLOW_FAILED",
          message: result.error?.message || "Preview generation failed.",
        };
      }

      if (result.status === "suspended") {
        // Extract suspension details for the agent to handle
        const suspendPayload = (result as Record<string, unknown>).suspendedSteps ??
          (result as Record<string, unknown>).suspendPayload ?? {};
        return {
          success: false,
          error: "WORKFLOW_SUSPENDED",
          message:
            "Preview generation needs additional input. " +
            `Details: ${JSON.stringify(suspendPayload)}`,
        };
      }

      if (result.status === "success" && result.result) {
        return {
          success: true,
          runId: result.result.runId,
          previewVersionId: result.result.previewVersionId,
          previewUrl: result.result.previewUrl,
        };
      }

      return {
        success: false,
        error: "UNEXPECTED_STATUS",
        message: `Workflow returned status: ${result.status}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[runGeneratePreviewWorkflow] Error:", message);

      // If it's a snapshot collision that wasn't cleaned, provide a clear message
      if (message.includes("duplicate key") && message.includes("mastra_workflow_snapshot")) {
        return {
          success: false,
          error: "SNAPSHOT_COLLISION",
          message:
            "A previous preview generation left stale data. Please try again — " +
            "the system has been cleaned up.",
        };
      }

      return {
        success: false,
        error: "EXECUTION_ERROR",
        message: `Preview generation encountered an error: ${message}`,
      };
    }
  },
});
