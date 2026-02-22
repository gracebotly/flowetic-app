

import { createSupaTool } from '../_base';
import { createAuthenticatedClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  sourceId: z.string().optional().describe(
    'Source UUID. If the agent sends a non-UUID (e.g. entity name), the tool will fall back to RequestContext sourceId.'
  ),
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
  execute: async (rawInput: unknown, context) => {
    const input = inputSchema.parse(rawInput);

    // Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getEventStats]: Missing authentication');
    }

    // ✅ Get tenantId from VALIDATED context, not input
    const tenantId = context.requestContext?.get('tenantId');

    if (!tenantId) {
      throw new Error('getEventStats: tenantId missing from request context');
    }

    
    // ✅ FIX: Fall back to RequestContext sourceId if agent sends non-UUID or nothing
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let sourceId = input.sourceId;

    // Case 1: Agent sent nothing → use RequestContext
    // Case 2: Agent sent non-UUID string (entity name) → override with RequestContext
    if (!sourceId || !UUID_RE.test(sourceId)) {
      const ctxSourceId = context.requestContext?.get('sourceId') as string | undefined;
      if (ctxSourceId && UUID_RE.test(ctxSourceId)) {
        console.log(
          `[getEventStats] Agent sent non-UUID sourceId "${sourceId ?? '(empty)'}", falling back to RequestContext: ${ctxSourceId}`
        );
        sourceId = ctxSourceId;
      } else if (sourceId && !UUID_RE.test(sourceId)) {
        // Agent sent garbage AND no valid RequestContext — skip source filter entirely
        console.warn(
          `[getEventStats] Agent sent non-UUID "${sourceId}" and no valid sourceId in RequestContext. Querying without source filter.`
        );
        sourceId = undefined;
      }
    }

    const { sinceDays } = input;


    const supabase = createAuthenticatedClient(accessToken);

    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - sinceDays);
    const sinceIso = sinceDate.toISOString();

    let query = supabase
      .from('events')
      .select('type, source_id, timestamp', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('timestamp', sinceIso);

    if (sourceId) query = query.eq('source_id', sourceId);

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



