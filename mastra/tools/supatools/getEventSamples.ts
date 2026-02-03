


import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { createAuthenticatedClient } from '../../lib/supabase';
import { z } from 'zod';

const EventType = z.enum(['message', 'metric', 'state', 'tool_event', 'error']);

const inputSchema = z.object({
  sourceId: z.string().uuid().optional(),
  type: EventType.optional(),
  limit: z.number().int().min(1).max(500).default(50),
  sinceDays: z.number().int().min(1).max(365).optional(),
});


export type EventSample = {
  id: string;
  type: z.infer<typeof EventType>;
  name: string | null;
  value: number | null;
  unit: string | null;
  text: string | null;
  state: unknown;
  labels: unknown;
  timestamp: string;
  sourceId: string;
};

const outputSchema = z.object({
  samples: z.array(
    z.object({
      id: z.string().uuid(),
      type: EventType,
      name: z.string().nullable(),
      value: z.number().nullable(),
      unit: z.string().nullable(),
      text: z.string().nullable(),
      state: z.any().nullable(),
      labels: z.any(),
      timestamp: z.string(),
      sourceId: z.string().uuid(),
    })
  ),
  totalCount: z.number(),
  limit: z.number(),
});

export const getEventSamples = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'getEventSamples',
  description:
    'Get sample event records for schema analysis and template selection. Returns up to limit events with all fields. limit is capped at 500.',
  inputSchema,
  outputSchema,
  
  execute: async (rawInput: unknown, context) => {
    const input = inputSchema.parse(rawInput);

    // Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getEventSamples]: Missing authentication');
    }

    // ✅ Get tenantId from VALIDATED context, not input
    const tenantId = context.requestContext?.get('tenantId');

    if (!tenantId) {
      throw new Error('getEventSamples: tenantId missing from request context');
    }

    const { sourceId, type, limit, sinceDays } = input;

    const supabase = createAuthenticatedClient(accessToken);

    let query = supabase
      .from('events')
      .select(
        'id, type, name, value, unit, text, state, labels, timestamp, source_id',
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (sourceId) query = query.eq('source_id', sourceId);
    if (type) query = query.eq('type', type);

    if (sinceDays) {
      const sinceDate = new Date();
      sinceDate.setUTCDate(sinceDate.getUTCDate() - sinceDays);
      query = query.gte('timestamp', sinceDate.toISOString());
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch event samples: ${error.message}`);

    const samples: EventSample[] = (data ?? []).map((e: any) => ({
      id: e.id,
      type: e.type,
      name: e.name ?? null,
      value: e.value === null || e.value === undefined ? null : Number(e.value),
      unit: e.unit ?? null,
      text: e.text ?? null,
      state: e.state ?? null,
      labels: e.labels ?? {},
      timestamp: e.timestamp,
      sourceId: e.source_id,
    }));

    return {
      samples,
      totalCount: typeof count === 'number' ? count : samples.length,
      limit,
    };
  },
});


