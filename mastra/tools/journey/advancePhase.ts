import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from '../../lib/supabase';
import { resolveStyleBundleId } from '../../lib/resolveStyleBundleId';

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
    // NOTE: advancePhase ONLY writes selectedEntities and selectedStyleBundleId.
    // selected_outcome is owned exclusively by recommendOutcome tool.
    // advancePhase previously wrote selectedOutcome with arbitrary LLM input,
    // overwriting the correct data-computed value (e.g., "workflow_ops" over "dashboard").
    // BUG 7 FIX: resolve slug here so it can be used both for RC and updateData below.
    let resolvedStyleSlug: string | null = null;
    if (selectedValue) {
      if (newPhase === 'recommend') {
        context?.requestContext?.set('selectedEntities', selectedValue);
      }
      // REMOVED: newPhase === 'style' → selectedOutcome write
      // recommendOutcome is the single source of truth for selected_outcome
      if (newPhase === 'style') {
        // Layout selection triggers recommend → style
        context?.requestContext?.set('selectedLayout', selectedValue);
      }
      if (newPhase === 'build_preview') {
        // BUG 7 FIX: Resolve display name → canonical slug BEFORE storing.
        // Without this, raw display names like "Modern SaaS" get stored,
        // which later fuzzy-match to wrong themes (e.g. "neon-cyber").
        resolvedStyleSlug = resolveStyleBundleId(selectedValue);
        if (resolvedStyleSlug) {
          context?.requestContext?.set('selectedStyleBundleId', resolvedStyleSlug);
        } else {
          // If resolution fails, still set the raw value on context
          // but do NOT write to DB (CHECK constraint would reject it)
          console.warn('[advancePhase] Could not resolve style bundle:', selectedValue);
          context?.requestContext?.set('selectedStyleBundleId', selectedValue);
        }
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
      recommend: {
        check: async () => ({ valid: true, missing: [] }),
        message: 'Cannot advance to recommend',
      },
      style: {
        check: async () => {
          const selectedOutcome = context.requestContext?.get('selectedOutcome');
          const missingFields: string[] = [];
          if (!selectedOutcome) {
            const { data } = await supabase
              .from('journey_sessions')
              .select('selected_outcome')
              .eq('thread_id', journeyThreadId)
              .eq('tenant_id', tenantId)
              .maybeSingle();
            if (!data?.selected_outcome) missingFields.push('selectedOutcome');
          }
          return { valid: missingFields.length === 0, missing: missingFields };
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
              .eq('thread_id', journeyThreadId)
              .eq('tenant_id', tenantId)
              .maybeSingle();
            if (!data?.selected_outcome) missingFields.push('selectedOutcome');
          }
          if (!selectedStyleBundleId) {
            const { data } = await supabase
              .from('journey_sessions')
              .select('selected_style_bundle_id')
              .eq('thread_id', journeyThreadId)
              .eq('tenant_id', tenantId)
              .maybeSingle();
            if (!data?.selected_style_bundle_id) missingFields.push('selectedStyleBundleId');
          }

          // CRITICAL: Check schema_ready from database
          const { data: sessionData } = await supabase
            .from('journey_sessions')
            .select('schema_ready')
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          if (sessionData?.schema_ready !== true) {
            missingFields.push('schemaReady (must be true in database)');
          }

          return { valid: missingFields.length === 0, missing: missingFields };
        },
        message: 'Cannot advance to build_preview: Missing required data or schema not ready',
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
    // NOTE: advancePhase does NOT write selected_outcome — that's owned by recommendOutcome.
    // BUG FIX: Query by thread_id, not id — use .select() to detect 0-row updates
    const updateData: Record<string, string> = {
      mode: newPhase,
      updated_at: new Date().toISOString(),
    };
    if (selectedValue && newPhase === 'recommend') {
      updateData.selected_entities = selectedValue;
    }
    // Persist layout selection when advancing to style
    if (selectedValue && newPhase === 'style') {
      updateData.selected_layout = selectedValue;
    }
    // BUG 7 FIX: Persist resolved style slug to DB when advancing to build_preview
    if (resolvedStyleSlug && newPhase === 'build_preview') {
      updateData.selected_style_bundle_id = resolvedStyleSlug;
    }
    // REMOVED: selected_outcome write for newPhase === 'style'
    // recommendOutcome tool is the single owner of selected_outcome.

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
