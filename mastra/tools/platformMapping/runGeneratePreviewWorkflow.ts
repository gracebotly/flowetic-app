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
    "All identity fields (tenantId, userId, interfaceId) are read from server context automatically. " +
    "Do NOT pass any IDs — only pass optional instructions if needed.",
  inputSchema: z.object({
    instructions: z.string().optional().describe("Optional extra instructions for preview generation"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    runId: z.string().optional(),
    previewVersionId: z.string().optional(),
    previewUrl: z.string().optional(),
    interfaceId: z.string().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    currentPhase: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    // Read ALL identity fields from RequestContext — NEVER from LLM input
    // The LLM hallucinates UUIDs (e.g. passes tenantId as userId, sourceId as interfaceId)
    const tenantId = context?.requestContext?.get('tenantId') as string;
    const userId = context?.requestContext?.get('userId') as string;
    const sourceId = context?.requestContext?.get('sourceId') as string;
    const userRole = (context?.requestContext?.get('userRole') as string) || 'client';
    const instructions = inputData.instructions || '';

    // interfaceId: prefer from RequestContext, fall back to sourceId
    // (the LLM was passing sourceId as interfaceId anyway — sourceId is correct for new dashboards)
    const interfaceId = (context?.requestContext?.get('interfaceId') as string) || sourceId;

    if (!tenantId || !userId) {
      return {
        success: false,
        error: "MISSING_CONTEXT",
        message: "tenantId or userId missing from RequestContext",
      };
    }

    if (!interfaceId) {
      return {
        success: false,
        error: "MISSING_INTERFACE_ID",
        message: "No interfaceId or sourceId found in RequestContext",
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE GUARD: Refuse to generate preview unless session is in build_preview
    // This prevents the LLM from bypassing advancePhase by calling this tool directly.
    // Check DB as source of truth — RequestContext phase may be stale.
    // ═══════════════════════════════════════════════════════════════════════
    const journeyThreadId = context?.requestContext?.get('journeyThreadId') as string;
    const supabaseToken = context?.requestContext?.get('supabaseAccessToken') as string;

    if (journeyThreadId && supabaseToken) {
      const supabase = createAuthenticatedClient(supabaseToken);

      const { data: session } = await supabase
        .from('journey_sessions')
        .select('mode, selected_outcome, selected_style_bundle_id, selected_entities, schema_ready, design_tokens')
        .eq('thread_id', journeyThreadId)
        .eq('tenant_id', tenantId)
        .single();

      if (session) {
        const missing: string[] = [];
        if (session.mode !== 'build_preview') missing.push(`phase is "${session.mode}" (must be "build_preview")`);
        if (!session.selected_outcome) missing.push('selectedOutcome not set');
        if (!session.selected_style_bundle_id && !session.design_tokens) missing.push('design system not set');
        if (!session.schema_ready) missing.push('schema not ready');

        if (missing.length > 0) {
          console.error(
            `[runGeneratePreviewWorkflow] PHASE GUARD BLOCKED execution. ${missing.join('; ')}`
          );
          return {
            success: false,
            error: "PHASE_GUARD",
            message: `Cannot generate preview: ${missing.join('; ')}. ` +
              `Complete the journey phases (select_entity → recommend → style → build_preview) first.`,
            currentPhase: session.mode,
          };
        }
      }
    } else {
      // If we can't verify from DB, check RequestContext phase as fallback
      const currentPhase = context?.requestContext?.get('phase') as string;
      if (currentPhase && currentPhase !== 'build_preview') {
        console.error(
          `[runGeneratePreviewWorkflow] PHASE GUARD (fallback): phase="${currentPhase}", blocked.`
        );
        return {
          success: false,
          error: "PHASE_GUARD",
          message: `Cannot generate preview from phase "${currentPhase}". Must be in "build_preview" phase.`,
          currentPhase,
        };
      }
    }

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
          interfaceId: (result.result as any).interfaceId,
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
