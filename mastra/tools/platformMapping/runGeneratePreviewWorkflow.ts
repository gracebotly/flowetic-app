// mastra/tools/platformMapping/runGeneratePreviewWorkflow.ts
// 
// CRITICAL FIX: Static imports + RequestContext forwarding
// - NO dynamic imports (prevents class duplication)
// - Forward parent requestContext instead of creating new one
//
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { randomUUID } from "crypto";
import { RequestContext } from "@mastra/core/request-context";
import { mastra } from "../../index";
import { createAuthenticatedClient } from "../../lib/supabase";

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

    try {
      // Use the statically imported singleton - NEVER dynamic import
      const workflow = mastra.getWorkflow("generatePreviewWorkflow");

      if (!workflow) {
        console.error("[runGeneratePreviewWorkflow] Workflow not found. Available workflows:", 
          Object.keys((mastra as any).workflows || {}));
        return {
          success: false,
          error: "WORKFLOW_NOT_FOUND",
          message: "The preview generation workflow is not registered.",
        };
      }

      // Clean up stale snapshots before creating a new run
      try {
        const accessToken = context?.requestContext?.get("supabaseAccessToken") as string;
        if (accessToken) {
          const supabase = createAuthenticatedClient(accessToken);

          // Delete snapshots older than 1 hour for this workflow
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { error: cleanupErr } = await supabase
            .from("mastra_workflow_snapshot")
            .delete()
            .eq("workflow_name", "generatePreviewWorkflow")
            .lt("created_at", oneHourAgo);

          if (cleanupErr) {
            console.warn("[runGeneratePreviewWorkflow] Snapshot cleanup warning:", cleanupErr.message);
          } else {
            console.log("[runGeneratePreviewWorkflow] Cleaned up stale workflow snapshots.");
          }
        }
      } catch (cleanupErr) {
        console.warn("[runGeneratePreviewWorkflow] Snapshot cleanup failed (non-fatal):", cleanupErr);
      }

      // Create a fresh run with a unique ID
      const run = await workflow.createRun({ runId: randomUUID() });

      // ═══════════════════════════════════════════════════════════════════════
      // FIX: Forward parent RequestContext instead of creating a new one
      // 
      // Creating a new RequestContext breaks the class brand chain because
      // the RequestContext class may have been instantiated from a different
      // chunk. By forwarding the parent context, we maintain consistent brands.
      // ═══════════════════════════════════════════════════════════════════════
      let requestContext: RequestContext;

      if (context?.requestContext) {
        // PREFERRED: Forward the parent's requestContext (correct Mastra v1 pattern)
        requestContext = context.requestContext as RequestContext;
        
        // Override with input values (they take precedence for this workflow)
        requestContext.set("tenantId", tenantId);
        requestContext.set("userId", userId);
        requestContext.set("interfaceId", interfaceId);
        
        console.log("[runGeneratePreviewWorkflow] Forwarding parent RequestContext");
      } else {
        // FALLBACK: Construct new context (should rarely happen)
        console.warn("[runGeneratePreviewWorkflow] No parent requestContext — constructing new one");
        requestContext = new RequestContext();

        // Copy relevant context values
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
        
        // Override with input values
        requestContext.set("tenantId", tenantId);
        requestContext.set("userId", userId);
        requestContext.set("interfaceId", interfaceId);
      }

      console.log("[runGeneratePreviewWorkflow] Starting workflow with:", {
        tenantId,
        userId,
        interfaceId,
        userRole,
      });

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
        console.error("[runGeneratePreviewWorkflow] Workflow failed:", result.error);
        return {
          success: false,
          error: "WORKFLOW_FAILED",
          message: result.error?.message || "Preview generation failed.",
        };
      }

      if (result.status === "suspended") {
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
        console.log("[runGeneratePreviewWorkflow] Workflow succeeded:", result.result);
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
      return {
        success: false,
        error: "WORKFLOW_EXECUTION_ERROR",
        message,
      };
    }
  },
});
