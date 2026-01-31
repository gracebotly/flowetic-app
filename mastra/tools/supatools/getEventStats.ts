

import { createSupaTool } from './_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const EventType = z.enum(['message', 'metric', 'state', 'tool_event', 'error']);

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  type: EventType.optional(),
  sinceDays: z.number().int().min(1).max(365).default(30),
});

const outputSchema = z.object({
  totalEvents: z.number(),
  eventsByType: z.record(z.string(), z.number()),
  eventsBySource: z.array(
    z.object({
      sourceId: z.string().uuid(),
      sourceName: z.string().optional(),
      count: z.number(),
    })
  ),
  dateRange: z.object({
    earliest: z.string().nullable(),
    latest: z.string().nullable(),
  }),
  errorCount: z.number(),
  metricCount: z.number(),
});

export const getEventStats = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'getEventStats',
  description:
    'Get statistical summary of events for a tenant. Returns total count, distribution by type/source, date range, and error/metric counts.',
  inputSchema,
  outputSchema,
  execute: async (rawInput: unknown) => {
    const input = inputSchema.parse(rawInput);
    const { tenantId, sourceId, type, sinceDays } = input;

    const supabase = createClient();

    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - sinceDays);
    const sinceIso = sinceDate.toISOString();

    let query = supabase
      .from('events')
      .select('type, source_id, timestamp', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('timestamp', sinceIso);

    if (sourceId) query = query.eq('source_id', sourceId);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch event stats: ${error.message}`);

    const rows: Array<{ type: string; source_id: string; timestamp: string }> = (data ??
      []) as any;

    const eventsByType: Record<string, number> = {};
    const eventsBySourceMap: Record<string, number> = {};

    let earliest: string | null = null;
    let latest: string | null = null;

    for (const r of rows) {
      const t = r.type ?? 'unknown';
      eventsByType[t] = (eventsByType[t] ?? 0) + 1;

      const sid = r.source_id;
      if (sid) eventsBySourceMap[sid] = (eventsBySourceMap[sid] ?? 0) + 1;

      if (r.timestamp) {
        if (!earliest || r.timestamp < earliest) earliest = r.timestamp;
        if (!latest || r.timestamp > latest) latest = r.timestamp;
      }
    }

    const sourceIds = Object.keys(eventsBySourceMap);
    const sourceNames =
      sourceIds.length > 0 ? await getSourceNames(supabase, tenantId, sourceIds) : {};

    const eventsBySource = sourceIds.map((sid) => ({
      sourceId: sid,
      sourceName: sourceNames[sid],
      count: eventsBySourceMap[sid] ?? 0,
    }));

    const totalEvents = typeof count === 'number' ? count : rows.length;

    return {
      totalEvents,
      eventsByType,
      eventsBySource,
      dateRange: { earliest, latest },
      errorCount: eventsByType['error'] ?? 0,
      metricCount: eventsByType['metric'] ?? 0,
    };
  },
});

async function getSourceNames(
  supabase: any,
  tenantId: string,
  sourceIds: string[]
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('sources')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .in('id', sourceIds);

  if (error) {
    // Non-fatal: return empty mapping, stats still useful
    return {};
  }

  const names: Record<string, string> = {};
  for (const s of data ?? []) {
    if (s?.id && s?.name) names[s.id] = s.name;
  }
  return names;
}



