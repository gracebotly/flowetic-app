
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const FloweticPhase = z.enum([
  "select_entity",
  "recommend",
  "style",
  "build_preview",
  "interactive_edit",
  "deploy",
]);

const VALID_TRANSITIONS: Record<string, string[]> = {
  select_entity: ["recommend"],
  recommend: ["style"],
  style: ["build_preview"],
  build_preview: ["interactive_edit"],
  interactive_edit: ["deploy"],
  deploy: [],
};

export const advancePhase = createTool({
  id: "advancePhase",
  description: `Advance the dashboard journey to the next phase. You MUST call this tool
when the user makes a selection to progress the journey:
- User selects entities → advance to "recommend"
- User chooses Dashboard or Product → advance to "style" (include "dashboard" or "product" as selectedValue)
- User picks a style bundle → advance to "build_preview" (include style bundle ID as selectedValue)
- Preview generated successfully → advance to "interactive_edit"
- User says "deploy" / "ship it" → advance to "deploy"

Without calling this tool, the phase stays stuck and instructions won't update.`,

  inputSchema: z.object({
    nextPhase: FloweticPhase.describe("The phase to advance to"),
    reason: z.string().min(1).describe("Why advancing (e.g., 'User selected 3 entities')"),
    selectedValue: z.string().optional().describe("The user's selection value"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    previousPhase: z.string(),
    currentPhase: z.string(),
    message: z.string(),
  }),

  execute: async (inputData, context) => {
    const { nextPhase, reason, selectedValue } = inputData;
    const currentPhase = (context?.requestContext?.get('phase') as string) || 'select_entity';

    const allowedNextPhases = VALID_TRANSITIONS[currentPhase] || [];
    if (!allowedNextPhases.includes(nextPhase)) {
      return {
        success: false,
        previousPhase: currentPhase,
        currentPhase: currentPhase,
        message: `Cannot advance from "${currentPhase}" to "${nextPhase}". Valid: ${allowedNextPhases.join(', ') || 'none'}`,
      };
    }

    // Update RequestContext for this request
    context?.requestContext?.set('phase', nextPhase);

    if (selectedValue) {
      if (nextPhase === 'style') context?.requestContext?.set('selectedOutcome', selectedValue);
      if (nextPhase === 'build_preview') context?.requestContext?.set('selectedStyleBundleId', selectedValue);
    }

    // Persist to journey_sessions in Supabase (non-blocking)
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    const tenantId = context?.requestContext?.get('tenantId') as string;
    const threadId = context?.requestContext?.get('threadId') as string;

    if (accessToken && tenantId && threadId) {
      try {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && serviceKey) {
          const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
          const updateData: Record<string, string> = { current_phase: nextPhase };
          if (selectedValue && nextPhase === 'style') updateData.selected_outcome = selectedValue;
          if (selectedValue && nextPhase === 'build_preview') updateData.selected_style_bundle_id = selectedValue;

          await supabase
            .from('journey_sessions')
            .update(updateData)
            .eq('tenant_id', tenantId)
            .eq('thread_id', threadId);
        }
      } catch (err) {
        console.warn('[advancePhase] Persistence failed (non-blocking):', err);
      }
    }

    console.log(`[advancePhase] ${currentPhase} → ${nextPhase} | Reason: ${reason}`);

    return {
      success: true,
      previousPhase: currentPhase,
      currentPhase: nextPhase,
      message: `Phase advanced: ${currentPhase} → ${nextPhase}`,
    };
  },
});

