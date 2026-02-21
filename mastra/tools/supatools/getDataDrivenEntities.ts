import { createSupaTool } from '../_base';
import { createAuthenticatedClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  sourceId: z.string().uuid().describe('The source ID to discover entities for'),
  sinceDays: z.number().int().min(1).max(365).default(30),
  workflowName: z.string().optional().describe('Workflow name to filter entities'),  // ADD THIS
});

const outputSchema = z.object({
  hasData: z.boolean(),
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      count: z.number(),
      latestTimestamp: z.string(),
      distinctFields: z.array(z.string()),
    })
  ),
  totalEvents: z.number(),
  dateRange: z.object({
    earliest: z.string().nullable(),
    latest: z.string().nullable(),
  }),
});

/**
 * Production-grade entity discovery using PostgreSQL RPC.
 * Aggregation happens in the database (FAST), not in JavaScript.
 *
 * This implements Phase 3A of the refactor: data-driven entity discovery.
 * Entities come from real event data, not LLM guesses.
 */
export const getDataDrivenEntities = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'getDataDrivenEntities',
  description:
    'Discover entities from real event data using database-level aggregation. Returns entity names with counts, types, and field names. ALWAYS call this BEFORE suggesting entities to users.',
  inputSchema,
  outputSchema,
  execute: async (rawInput: unknown, context) => {
    const input = inputSchema.parse(rawInput);

    // ✅ Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getDataDrivenEntities]: Missing authentication token');
    }

    // ✅ Get tenantId from VALIDATED context
    const tenantId = context.requestContext?.get('tenantId');
    if (!tenantId) {
      throw new Error('[getDataDrivenEntities]: tenantId missing from request context');
    }

    const { sourceId, sinceDays } = input;

    const supabase = createAuthenticatedClient(accessToken);

    // ✅ Call PostgreSQL RPC function (production-grade aggregation)
    const rpcStartMs = Date.now();
    const { data, error } = await supabase.rpc('get_data_driven_entities', {
      p_tenant_id: tenantId,
      p_source_id: sourceId,
      p_since_days: sinceDays,
      p_workflow_name: input.workflowName || null,  // ADD THIS
    });
    console.log(`[TIMING] getDataDrivenEntities.rpc: ${Date.now() - rpcStartMs}ms`);

    if (error) {
      throw new Error(
        `[getDataDrivenEntities]: Database aggregation failed: ${error.message}`
      );
    }

    // The RPC returns a single row with aggregated data
    const result = data?.[0];

    if (!result) {
      console.log('[getDataDrivenEntities]: No data returned from RPC');
      return {
        hasData: false,
        entities: [],
        totalEvents: 0,
        dateRange: { earliest: null, latest: null },
      };
    }

    console.log(`[getDataDrivenEntities]: Found ${result.entities?.length || 0} entities with ${result.total_events} total events`);

    return {
      hasData: result.has_data,
      entities: result.entities || [],
      totalEvents: result.total_events,
      dateRange: result.date_range,
    };
  },
});
