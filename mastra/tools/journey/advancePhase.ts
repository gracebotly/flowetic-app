
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { safeUuid } from "../../lib/safeUuid";
import { resolveStyleBundleId, STYLE_BUNDLE_TOKENS } from "../generateUISpec";

const FloweticPhase = z.enum([
  "select_entity",
  "recommend",
  "style",
  "build_preview",
  "interactive_edit",
  "deploy",
]);


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
    // Warning: Manual phase transition triggered
    console.warn(
      '[advancePhase] Manual phase transition triggered. This should be rare - most transitions are auto-driven by user selections.'
    );

    const { nextPhase, reason, selectedValue } = inputData;
    const currentPhase = (context?.requestContext?.get('phase') as string) || 'select_entity';

    // Define valid sequential transitions - no skipping allowed
    // Matches vibeJourneyWorkflow.ts nextPhaseForSelection() logic
    const VALID_TRANSITIONS: Record<string, string[]> = {
      select_entity: ['recommend'],
      recommend: ['style'],
      style: ['build_preview'],
      build_preview: ['interactive_edit'],
      interactive_edit: ['deploy'],
      deploy: [],
    };

    // Validate transition is allowed
    if (!VALID_TRANSITIONS[currentPhase]?.includes(nextPhase)) {
      const allowedPhases = VALID_TRANSITIONS[currentPhase] || [];
      return {
        success: false,
        previousPhase: currentPhase,
        currentPhase: currentPhase,
        message: `Invalid transition: "${currentPhase}" can only advance to ${allowedPhases.length > 0 ? allowedPhases.join(', ') : 'none (terminal phase)'}. Cannot jump to "${nextPhase}".`,
      };
    }

    // Update RequestContext for this request
    context?.requestContext?.set('phase', nextPhase);

    // Verify the update took effect
    const verifyPhase = context?.requestContext?.get('phase');
    console.log('[advancePhase] RequestContext updated:', {
      previousPhase: currentPhase,
      targetPhase: nextPhase,
      verifyRead: verifyPhase,
      match: verifyPhase === nextPhase,
    });

    if (selectedValue) {
      if (nextPhase === 'style') context?.requestContext?.set('selectedOutcome', selectedValue);
      if (nextPhase === 'build_preview') {
        const resolvedKey = resolveStyleBundleId(selectedValue);
        context?.requestContext?.set('selectedStyleBundleId', STYLE_BUNDLE_TOKENS[resolvedKey] ? resolvedKey : 'professional-clean');
      }
    }

    // Persist to journey_sessions in Supabase (non-blocking)
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    const tenantId = context?.requestContext?.get('tenantId') as string;
    // Get both thread IDs - they map to different columns
    const rawJourneyThreadId = context?.requestContext?.get('journeyThreadId') as string | undefined;
    const rawMastraThreadId = context?.requestContext?.get('threadId') as string | undefined;
    // Extract clean UUID from potentially compound IDs (e.g., "sourceId:externalId")
    const journeyThreadId = safeUuid(rawJourneyThreadId, 'journeyThreadId') ?? rawJourneyThreadId;
    const mastraThreadId = safeUuid(rawMastraThreadId, 'mastraThreadId') ?? rawMastraThreadId;

    if (accessToken && tenantId && (journeyThreadId || mastraThreadId)) {
      try {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && serviceKey) {
          const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

          // Note: column is 'mode' not 'current_phase' based on schema
          const updateData: Record<string, string> = {
            mode: nextPhase,
            updated_at: new Date().toISOString(),
          };
          if (selectedValue && nextPhase === 'style') {
            updateData.selected_outcome = selectedValue;
          }
          if (selectedValue && nextPhase === 'build_preview') {
            const resolvedStyleKey = resolveStyleBundleId(selectedValue);
            if (!STYLE_BUNDLE_TOKENS[resolvedStyleKey]) {
              console.warn(`[advancePhase] Could not resolve style "${selectedValue}". Storing fallback "professional-clean".`);
              updateData.selected_style_bundle_id = 'professional-clean';
            } else {
              console.log(`[advancePhase] Resolved style "${selectedValue}" → "${resolvedStyleKey}"`);
              updateData.selected_style_bundle_id = resolvedStyleKey;
            }
          }

          // Determine correct column based on available ID
          const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let queryColumn: 'thread_id' | 'mastra_thread_id';
          let queryValue: string;

          if (journeyThreadId && UUID_RE.test(journeyThreadId)) {
            queryColumn = 'thread_id';
            queryValue = journeyThreadId;
          } else if (mastraThreadId && UUID_RE.test(mastraThreadId)) {
            queryColumn = 'mastra_thread_id';
            queryValue = mastraThreadId;
          } else {
            console.warn('[advancePhase] No valid thread ID for DB update');
            return {
              success: true,  // Still succeed in-memory, just warn about persistence
              previousPhase: currentPhase,
              currentPhase: nextPhase,
              message: `Phase advanced (not persisted): ${currentPhase} → ${nextPhase}`,
            };
          }

          // Use separate queries to avoid PostgREST .or() filter issues
          // that cause misleading "column does not exist" errors
          let updateResult: { id: string; mode: string } | null = null;
          let updateError: { message: string } | null = null;

          // First try: match by thread_id
          const result1 = await supabase
            .from('journey_sessions')
            .update(updateData)
            .eq('tenant_id', tenantId)
            .eq('mode', currentPhase)
            .eq('thread_id', queryValue)
            .select('id, mode')
            .maybeSingle();

          if (result1.data) {
            updateResult = result1.data;
            updateError = result1.error;
          } else if (!result1.error || result1.error.message?.includes('0 rows')) {
            // Fallback: match by mastra_thread_id
            const result2 = await supabase
              .from('journey_sessions')
              .update(updateData)
              .eq('tenant_id', tenantId)
              .eq('mode', currentPhase)
              .eq('mastra_thread_id', queryValue)
              .select('id, mode')
              .maybeSingle();

            updateResult = result2.data;
            updateError = result2.error;
          } else {
            updateError = result1.error;
          }

          if (updateError) {
            console.error('[advancePhase] DB update error:', updateError.message);
            return {
              success: false,
              previousPhase: currentPhase,
              currentPhase: currentPhase,
              message: `Phase update failed: ${updateError.message}`,
            };
          }

          // CAS conflict: no rows matched means phase was already changed by another request
          if (!updateResult) {
            // Use separate queries to avoid PostgREST .or() filter issues
            let freshState: { id: string; mode: string } | null = null;

            const fresh1 = await supabase
              .from('journey_sessions')
              .select('id, mode')
              .eq('tenant_id', tenantId)
              .eq('thread_id', queryValue)
              .maybeSingle();

            if (fresh1.data) {
              freshState = fresh1.data;
            } else {
              const fresh2 = await supabase
                .from('journey_sessions')
                .select('id, mode')
                .eq('tenant_id', tenantId)
                .eq('mastra_thread_id', queryValue)
                .maybeSingle();
              freshState = fresh2.data;
            }

            if (freshState?.mode === nextPhase) {
              // Another request already advanced to the same target — treat as success
              console.log('[advancePhase] Phase already at target (concurrent advance):', {
                currentPhase: freshState.mode,
                targetPhase: nextPhase,
              });
            } else {
              console.warn('[advancePhase] Race condition detected:', {
                expectedPhase: currentPhase,
                actualPhase: freshState?.mode,
                attemptedPhase: nextPhase,
              });
              return {
                success: false,
                previousPhase: currentPhase,
                currentPhase: freshState?.mode || currentPhase,
                message: `Phase conflict: expected '${currentPhase}' but DB has '${freshState?.mode}'. Another request already changed the phase.`,
              };
            }
          } else if (updateResult.mode !== nextPhase) {
            console.error('[advancePhase] Phase mismatch after update:', {
              expected: nextPhase,
              actual: updateResult.mode,
              sessionId: updateResult.id,
            });
            return {
              success: false,
              previousPhase: currentPhase,
              currentPhase: updateResult.mode,
              message: `Phase verification failed: expected '${nextPhase}' but got '${updateResult.mode}'`,
            };
          } else {
            console.log('[advancePhase] DB update verified:', {
              sessionId: updateResult.id,
              newPhase: nextPhase,
              verified: true,
            });
          }
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

