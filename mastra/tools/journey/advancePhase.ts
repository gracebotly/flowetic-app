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
- select_entity → recommend: Auto-advances when entity selected
- recommend → style: Auto-advances when outcome selected
- style → build_preview: Auto-advances when style selected AND schema ready

Only use this tool for:
- User explicitly requests to skip a phase
- Error recovery (stuck state)
- Override when automatic transition failed

Valid phases: select_entity, recommend, style, build_preview, refine`,

  inputSchema: z.object({
    newPhase: z.enum([
      'select_entity',
      'recommend',
      'style',
      'build_preview',
      'refine',
    ]),
    selectedValue: z.string().optional().describe('Optional value to persist (entities for recommend, outcome for style)'),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    newPhase: z.string(),
    message: z.string(),
  }),

  execute: async (input, context) => {
    const { newPhase, selectedValue } = input;
    const tenantId = context.requestContext?.get('tenantId') as string;
    const journeyThreadId = context.requestContext?.get('journeyThreadId') as string;

    if (!tenantId) {
      // RETURN instead of throw — thrown errors become tool-error content parts
      // that cause Gemini to hallucinate non-existent tools (mastra#9815)
      return {
        success: false,
        newPhase: 'unknown',
        message: '[advancePhase] Missing tenantId in RequestContext',
      };
    }
    if (!journeyThreadId) {
      return {
        success: false,
        newPhase: 'unknown',
        message: '[advancePhase] Missing journeyThreadId in RequestContext',
      };
    }

    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken) {
      return {
        success: false,
        newPhase: 'unknown',
        message: '[advancePhase] Missing supabaseAccessToken in RequestContext',
      };
    }
    const supabase = createAuthenticatedClient(accessToken);

    // Set RequestContext based on selectedValue and phase
    if (selectedValue) {
      if (newPhase === 'recommend') {
        context?.requestContext?.set('selectedEntities', selectedValue);
      }
      if (newPhase === 'style') context?.requestContext?.set('selectedOutcome', selectedValue);
      if (newPhase === 'build_preview') {
        context?.requestContext?.set('selectedStyleBundleId', selectedValue);
      }
    }

    // Validation: Check required data based on target phase
    const requiredDataMap: Record<string, {
      check: () => Promise<{ valid: boolean; missing: string[] }>;
      message: string;
    }> = {
      recommend: {
        check: async () => {
          // Recommend phase gets entities via selectedValue param - no pre-existing requirement
          return {
            valid: true,
            missing: [],
          };
        },
        message: 'Cannot advance to recommend',
      },
      style: {
        check: async () => {
          const selectedOutcome = context.requestContext?.get('selectedOutcome');

          const missingFields: string[] = [];
          if (!selectedOutcome) {
            // Check database fallback
            const { data } = await supabase
              .from('journey_sessions')
              .select('selected_outcome')
              .eq('id', journeyThreadId)
              .eq('tenant_id', tenantId)
              .single();

            if (!data?.selected_outcome) {
              missingFields.push('selectedOutcome');
            }
          }

          return {
            valid: missingFields.length === 0,
            missing: missingFields,
          };
        },
        message: 'Cannot advance to style: Missing required selections',
      },
      build_preview: {
        check: async () => {
          const selectedOutcome = context.requestContext?.get('selectedOutcome');
          const selectedStyleBundleId = context.requestContext?.get('selectedStyleBundleId');

          const missingFields: string[] = [];

          if (!selectedOutcome) {
            const { data } = await supabase
              .from('journey_sessions')
              .select('selected_outcome')
              .eq('id', journeyThreadId)
              .eq('tenant_id', tenantId)
              .single();
            if (!data?.selected_outcome) missingFields.push('selectedOutcome');
          }

          if (!selectedStyleBundleId) {
            const { data } = await supabase
              .from('journey_sessions')
              .select('selected_style_bundle_id')
              .eq('id', journeyThreadId)
              .eq('tenant_id', tenantId)
              .single();
            if (!data?.selected_style_bundle_id) missingFields.push('selectedStyleBundleId');
          }

          // CRITICAL: Check schema_ready from database
          const { data: sessionData } = await supabase
            .from('journey_sessions')
            .select('schema_ready')
            .eq('id', journeyThreadId)
            .eq('tenant_id', tenantId)
            .single();

          if (sessionData?.schema_ready !== true) {
            missingFields.push('schemaReady (must be true in database)');
          }

          return {
            valid: missingFields.length === 0,
            missing: missingFields,
          };
        },
        message: 'Cannot advance to build_preview: Missing required data or schema not ready',
      },
    };

    // Run validation if applicable
    const validation = requiredDataMap[newPhase];
    if (validation) {
      const result = await validation.check();
      if (!result.valid) {
        // ✅ RETURN error object instead of throwing.
        // Thrown errors become tool-error content parts that cause Gemini to
        // hallucinate non-existent tools (e.g. "analyzeSchema"), which crashes
        // the agentic loop due to Mastra issue #9815.
        const currentPhase = context.requestContext?.get('phase') as string || 'unknown';
        return {
          success: false,
          newPhase: currentPhase,
          message: `${validation.message}. Still needed: ${result.missing.join(', ')}. Please complete the current phase first.`,
        };
      }
    }

    // Update phase and persist selected values
    const updateData: Record<string, string> = {
      mode: newPhase,
      updated_at: new Date().toISOString(),
    };
    if (selectedValue && newPhase === 'recommend') {
      updateData.selected_entities = selectedValue;
    }
    if (selectedValue && newPhase === 'style') {
      updateData.selected_outcome = selectedValue;
    }

    const { error } = await supabase
      .from('journey_sessions')
      .update(updateData)
      .eq('id', journeyThreadId)
      .eq('tenant_id', tenantId);

    if (error) {
      // ✅ RETURN instead of throw
      const currentPhase = context.requestContext?.get('phase') as string || 'unknown';
      return {
        success: false,
        newPhase: currentPhase,
        message: `Failed to advance phase: ${error.message}`,
      };
    }

    return {
      success: true,
      newPhase,
      message: `✅ Phase manually advanced to: ${newPhase}`,
    };
  },
});
