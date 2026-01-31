

import { createSupaTool } from '../_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  type: z.enum(['message', 'metric', 'state', 'tool_event', 'error']).optional(),
  sinceDays: z.number().min(1).max(365).optional().default(30),
});

const outputSchema = z.object({
  totalEvents: z.number(),
  eventsByType: z.record(z.string(), z.number()),
  eventsBySource: z.array(z.object({
    sourceId: z.string().uuid(),
    sourceName: z.string().optional(),
    count: z.number(),
  })),
  dateRange: z.object({
    earliest: z.string(),
    latest: z.string(),
  }),
  errorCount: z.number(),
  metricCount: z.number(),
});

export const getEventStats = createSupaTool({
  id: 'getEventStats',
  description: 'Get statistical summary of events for a tenant. Returns total count, distribution by type/source, date range, and error/metric counts. Used for data validation before dashboard generation.',
  inputSchema,
  outputSchema,
  execute: async (inputData: any, context: any) => {
    const { tenantId, sourceId, type, sinceDays } = inputData;
    const supabase = createClient();
    
    // Calculate date cutoff
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);
    const sinceIso = sinceDate.toISOString();
    
    // Build query
    let query = supabase
      .from('events')
      .select('id, type, source_id, timestamp, created_at')
      .eq('tenant_id', tenantId)
      .gte('timestamp', sinceIso);
    
    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch event stats: ${error.message}`);
    }
    
    if (!events || events.length === 0) {
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySource: [],
        dateRange: { earliest: '', latest: '' },
        errorCount: 0,
        metricCount: 0,
      };
    }
    
    // Calculate stats
    const eventsByType: Record<string, number> = {};
    const eventsBySourceMap: Record<string, { count: number; sourceId: string }> = {};
    let earliestTimestamp = events[0]!.timestamp;
    let latestTimestamp = events[0]!.timestamp;
    
    for (const event of events) {
      const type = event.type || 'unknown';
      eventsByType[type] = (eventsByType[type] || 0) + 1;
      
      if (event.source_id) {
        const key = event.source_id;
        if (!eventsBySourceMap[key]) {
          eventsBySourceMap[key] = { count: 0, sourceId: key };
        }
        eventsBySourceMap[key]!.count++;
      }
      
      if (event.timestamp < earliestTimestamp) {
        earliestTimestamp = event.timestamp;
      }
      if (event.timestamp > latestTimestamp) {
        latestTimestamp = event.timestamp;
      }
    }
    
    // Get source names
    const sourceIds = Object.keys(eventsBySourceMap);
    const sourceNames = sourceIds.length > 0 
      ? await getSourceNames(supabase, sourceIds)
      : {};
    
    const eventsBySource = Object.values(eventsBySourceMap).map(s => ({
      sourceId: s.sourceId,
      sourceName: sourceNames[s.sourceId],
      count: s.count,
    }));
    
    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySource,
      dateRange: {
        earliest: earliestTimestamp,
        latest: latestTimestamp,
      },
      errorCount: eventsByType['error'] || 0,
      metricCount: eventsByType['metric'] || 0,
    };
  },
});

async function getSourceNames(
  supabase: any,
  sourceIds: string[]
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('sources')
    .select('id, name')
    .in('id', sourceIds);
    
  const names: Record<string, string> = {};
  for (const source of data || []) {
    names[source.id] = source.name;
  }
  return names;
}

