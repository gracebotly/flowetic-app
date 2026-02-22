import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * confirmWireframe — Agent-driven fallback for marking wireframe as confirmed.
 *
 * Primary path: Eager regex detection in route.ts (runs BEFORE agent).
 * This tool is the FALLBACK: if the regex misses a natural language confirmation
 * (e.g., "This looks about right and accurate"), the agent can call this tool
 * to explicitly set wireframe_confirmed=true on journey_sessions.
 *
 * This tool does NOT advance the phase. Phase advancement is handled by
 * autoAdvancePhase in onFinish, which reads wireframe_confirmed from DB.
 *
 * Only callable in the `recommend` phase (enforced by PHASE_TOOL_ALLOWLIST).
 */
export const confirmWireframe = createTool({
  id: "confirmWireframe",
  description:
    "Mark the wireframe as confirmed by the user. Call this when the user approves the wireframe layout (e.g., 'looks good', 'that works', 'yes'). Only use after you have presented a wireframe and the user has indicated approval. Do NOT call this if the user is asking for changes.",
  inputSchema: z.object({
    reason: z
      .string()
      .describe("Brief note on what the user said to confirm (e.g., 'User said: looks about right')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (input, context) => {
    const tenantId = context?.requestContext?.get("tenantId") as string | undefined;
    const journeyThreadId = context?.requestContext?.get("journeyThreadId") as string | undefined;

    if (!tenantId) {
      throw new Error("[confirmWireframe] tenantId missing from requestContext");
    }
    if (!journeyThreadId) {
      throw new Error("[confirmWireframe] journeyThreadId missing from requestContext");
    }

    const supabase = await createClient();

    // Verify session exists and is in recommend phase
    const { data: session, error: fetchError } = await supabase
      .from("journey_sessions")
      .select("id, mode, wireframe_confirmed, selected_outcome")
      .eq("thread_id", journeyThreadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (fetchError || !session) {
      return {
        success: false,
        message: `Session not found for thread ${journeyThreadId}`,
      };
    }

    if (session.mode !== "recommend") {
      return {
        success: false,
        message: `Cannot confirm wireframe in phase "${session.mode}" — only valid in "recommend" phase`,
      };
    }

    if (session.wireframe_confirmed) {
      return {
        success: true,
        message: "Wireframe was already confirmed",
      };
    }

    if (!session.selected_outcome) {
      return {
        success: false,
        message: "Cannot confirm wireframe before outcome is selected",
      };
    }

    // Set wireframe_confirmed=true
    const { error: updateError } = await supabase
      .from("journey_sessions")
      .update({
        wireframe_confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("[confirmWireframe] DB update failed:", updateError.message);
      return {
        success: false,
        message: `Database error: ${updateError.message}`,
      };
    }

    console.log("[confirmWireframe] ✅ Wireframe confirmed via agent tool:", {
      sessionId: session.id,
      reason: input.reason,
    });

    return {
      success: true,
      message: "Wireframe confirmed. The system will advance to the style phase automatically.",
    };
  },
});
