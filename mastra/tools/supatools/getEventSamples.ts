


import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  type: z.enum(['message', 'metric', 'state', 'tool_event', 'error']).optional(),
  limit: z.number().min(1).max(500).default(50),
  sinceDays: z.number().min(1).max(365).optional(),
});

export interface EventSample {
  id: string;
  type: string;
  name: string | null;
  value: number | null;
  unit: string | null;
  text: string | null;
  state: any;
  labels: any;
  timestamp: string;
  sourceId: string;
}

const outputSchema = z.object({
  samples: z.array(z.object({
    id: z.string().uuid(),
    type: z.string(),
    name: z.string().nullable(),
    value: z.number().nullable(),
    unit: z.string().nullable(),
    text: z.string().nullable(),
    state: z.any(),
    labels: z.any(),
    timestamp: z.string(),
    sourceId: z.string().uuid(),
  })),
  totalCount: z.number(),
  limit: z.number(),
});

export const getEventSamples = createSupaTool({
  id: 'getEventSamples',
  description: 'Get sample event records for schema analysis and template selection. Returns up to limit events with all fields. Use limit <= 500 to avoid performance issues.',
  inputSchema,
  outputSchema,
  execute: async (inputData: any, context: any) => {
    const { tenantId, sourceId, type, limit, sinceDays } = inputData;
    const supabase = createClient();
    
    // Build query
    let query = supabase
      .from('events')
      .select('id, type, name, value, unit, text, state, labels, timestamp, source_id')
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    if (sinceDays) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - sinceDays);
      query = query.gte('timestamp', sinceDate.toISOString());
    }
    
    const { data: events, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch event samples: ${error.message}`);
    }
    
    const samples: EventSample[] = (events || []).map(e => ({
      id: e.id,
      type: e.type,
      name: e.name,
      value: e.value,
      unit: e.unit,
      text: e.text,
      state: e.state,
      labels: e.labels,
      timestamp: e.timestamp,
      sourceId: e.source_id,
    }));
    
    return {
      samples,
      totalCount: count || 0,
      limit,
    };
  },
});


