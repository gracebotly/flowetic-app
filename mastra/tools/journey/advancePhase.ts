import { createTool } from '@mastra/core';
import { z } from 'zod';

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
  }),

  execute: async (input, context) => {
    const { newPhase } = input;
    const tenantId = context.requestContext?.get('tenantId') as string;
    const journeyThreadId = context.requestContext?.get('journeyThreadId') as string;

    if (!tenantId) {
      throw new Error('[advancePhase] Missing tenantId in RequestContext');
    }
    if (!journeyThreadId) {
      throw new Error('[advancePhase] Missing journeyThreadId in RequestContext');
    }

    const supabase = context.mastra?.getStorage()?.client;
    if (!supabase) {
      throw new Error('[advancePhase] No Supabase client available');
    }

    // Validation: Check required data based on target phase
    const requiredDataMap: Record<string, {
      check: () => Promise<{ valid: boolean; missing: string[] }>;
      message: string;
    }> = {
      recommend: {
        check: async () => {
          const selectedEntities = context.requestContext?.get('selectedEntities');
          const selectedEntity = context.requestContext?.get('selectedEntity');
          return {
            valid: !!(selectedEntities || selectedEntity),
            missing: selectedEntities || selectedEntity ? [] : ['selectedEntities or selectedEntity'],
          };
        },
        message: 'Cannot advance to recommend: No entity selected',
      },
      style: {
        check: async () => {
          const selectedEntities = context.requestContext?.get('selectedEntities');
          const selectedEntity = context.requestContext?.get('selectedEntity');
          const selectedOutcome = context.requestContext?.get('selectedOutcome');

          const missingFields: string[] = [];
          if (!selectedEntities && !selectedEntity) missingFields.push('selectedEntities or selectedEntity');
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
          const selectedEntities = context.requestContext?.get('selectedEntities');
          const selectedEntity = context.requestContext?.get('selectedEntity');
          const selectedOutcome = context.requestContext?.get('selectedOutcome');
          const selectedStyleBundleId = context.requestContext?.get('selectedStyleBundleId');

          const missingFields: string[] = [];

          if (!selectedEntities && !selectedEntity) missingFields.push('selectedEntities or selectedEntity');

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
        throw new Error(`${validation.message}. Missing: ${result.missing.join(', ')}`);
      }
    }

    // Update phase
    const { error } = await supabase
      .from('journey_sessions')
      .update({ mode: newPhase })
      .eq('id', journeyThreadId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to advance phase: ${error.message}`);
    }

    return {
      success: true,
      newPhase,
      message: `✅ Phase manually advanced to: ${newPhase}`,
    };
  },
});
