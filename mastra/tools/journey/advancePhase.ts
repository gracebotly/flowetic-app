import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from '../../lib/supabase';

/**
 * EDGE CASE TOOL - Manually advance journey phase
 *
 * IMPORTANT: This tool should RARELY be called because phase transitions
 * are now AUTOMATIC based on user selections. The chat route automatically
 * advances phases when:
 *
 * - select_entity → recommend: When selectedEntities/selectedEntity exists
 * - recommend → style: When selectedOutcome exists
 * - style → build_preview: When selectedStyleBundleId exists AND schema_ready=true
 *
 * Only use this tool for:
 * - Skipping phases (user explicitly requests to skip)
 * - Error recovery (stuck state, need manual override)
 * - Testing/debugging
 */
export const advancePhase = createTool({
  id: 'advancePhase',
  description: `Manually advance the journey phase.

⚠️ IMPORTANT: Phase transitions are AUTOMATIC based on user selections:
- propose → build_edit: Auto-advances when user selects a proposal
- build_edit → deploy: Auto-advances when user confirms deployment

Only use this tool for:
- User explicitly requests to skip a phase
- Error recovery (stuck state)
- Override when automatic transition failed

Valid phases: propose, build_edit, deploy`,

  inputSchema: z.object({
    newPhase: z.enum([
      'propose',
      'build_edit',
      'deploy',
    ]),
    selectedValue: z.string().optional().describe('Optional value to persist (entities for recommend, outcome for style)'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    newPhase: z.string(),
    currentPhase: z.string(),  // UI compatibility alias — mirrors newPhase on success, unchanged phase on failure
    message: z.string(),
  }),

  execute: async (input, context) => {
    const { newPhase, selectedValue } = input;
    const tenantId = context.requestContext?.get('tenantId') as string;
    const journeyThreadId = context.requestContext?.get('journeyThreadId') as string;
    const contextPhase = (context.requestContext?.get('phase') as string) || 'unknown';

    if (!tenantId) {
      return {
        success: false,
        newPhase: contextPhase,
        currentPhase: contextPhase,
        message: '[advancePhase] Missing tenantId in RequestContext',
      };
    }
    if (!journeyThreadId) {
      return {
        success: false,
        newPhase: contextPhase,
        currentPhase: contextPhase,
        message: '[advancePhase] Missing journeyThreadId in RequestContext',
      };
    }

    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken) {
      return {
        success: false,
        newPhase: contextPhase,
        currentPhase: contextPhase,
        message: '[advancePhase] Missing supabaseAccessToken in RequestContext',
      };
    }
    const supabase = createAuthenticatedClient(accessToken);

    // Set RequestContext based on selectedValue and phase
    if (selectedValue) {
      if (newPhase === 'build_edit') {
        context?.requestContext?.set('selectedProposalIndex', selectedValue);
      }
      if (newPhase === 'deploy') {
        context?.requestContext?.set('deployIntent', selectedValue);
      }
    }


    // Validation: Check required data based on target phase
    // BUG FIX: Use thread_id column, not id column.
    // ensureMastraThreadId inserts with thread_id = journeyThreadId; id = gen_random_uuid().
    // Querying by id silently matches 0 rows.
    const requiredDataMap: Record<string, {
      check: () => Promise<{ valid: boolean; missing: string[] }>;
      message: string;
    }> = {
      build_edit: {
        check: async () => {
          const missingFields: string[] = [];
          const { data: sessionData } = await supabase
            .from('journey_sessions')
            .select('selected_proposal_index, design_tokens, proposals')
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (sessionData?.selected_proposal_index == null && !sessionData?.design_tokens) {
            missingFields.push('proposal selection or design tokens (must select a proposal first)');
          }
          return { valid: missingFields.length === 0, missing: missingFields };
        },
        message: 'Cannot advance to build_edit: No proposal selected and no design tokens present',
      },
      deploy: {
        check: async () => {
          const missingFields: string[] = [];
          const { data: sessionData } = await supabase
            .from('journey_sessions')
            .select('preview_interface_id, preview_version_id')
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (!sessionData?.preview_interface_id || !sessionData?.preview_version_id) {
            missingFields.push('preview must be generated before deploying');
          }
          return { valid: missingFields.length === 0, missing: missingFields };
        },
        message: 'Cannot advance to deploy: Preview has not been generated yet',
      },
    };


    const validation = requiredDataMap[newPhase];
    if (validation) {
      const result = await validation.check();
      if (!result.valid) {
        return {
          success: false,
          newPhase: contextPhase,
          currentPhase: contextPhase,
          message: `${validation.message}. Still needed: ${result.missing.join(', ')}. Please complete the current phase first.`,
        };
      }
    }

    // Update phase and persist selected values
    const updateData: Record<string, any> = {
      mode: newPhase,
      updated_at: new Date().toISOString(),
    };
    if (selectedValue && newPhase === 'build_edit') {
      const parsed = Number(selectedValue);
      if (Number.isFinite(parsed)) {
        updateData.selected_proposal_index = parsed;
      }
    }

    const { data: updatedRows, error } = await supabase
      .from('journey_sessions')
      .update(updateData)
      .eq('thread_id', journeyThreadId)
      .eq('tenant_id', tenantId)
      .select();

    if (error) {
      return {
        success: false,
        newPhase: contextPhase,
        currentPhase: contextPhase,
        message: `Failed to advance phase: ${error.message}`,
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error('[advancePhase] No rows updated:', { journeyThreadId, tenantId });
      return {
        success: false,
        newPhase: contextPhase,
        currentPhase: contextPhase,
        message: 'No matching journey session found. The session may have expired or the thread ID is incorrect.',
      };
    }

    return {
      success: true,
      newPhase,
      currentPhase: newPhase,
      message: `✅ Phase manually advanced to: ${newPhase}`,
    };
  },
});
