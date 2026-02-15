import { createSupaTool } from '../_base';
import { createAuthenticatedClient } from '../../lib/supabase';
import { z } from 'zod';

const outputSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      eventType: z.string(),
      count: z.number(),
      sampleNames: z.array(z.string()).optional(),
    })
  ),
  totalEvents: z.number(),
  hasData: z.boolean(),
});

export const getDataDrivenEntities = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'getDataDrivenEntities',
  description:
    'Query events table to discover real entities with actual event counts. Returns entities grouped by event name and type. Use this BEFORE suggesting entities to ensure suggestions are data-driven, not guessed.',
  inputSchema: z.object({
    sourceId: z.string().uuid(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  outputSchema,
  execute: async (rawInput: unknown, context) => {
    const input = z
      .object({
        sourceId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(10),
      })
      .parse(rawInput);

    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getDataDrivenEntities]: Missing authentication');
    }

    const tenantId = context.requestContext?.get('tenantId');
    if (!tenantId) {
      throw new Error('[getDataDrivenEntities]: tenantId missing from request context');
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Query events grouped by name and type
    const { data, error, count } = await supabase
      .from('events')
      .select('name, type', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('source_id', input.sourceId)
      .not('name', 'is', null)
      .order('name');

    if (error) throw new Error(`Failed to fetch entities: ${error.message}`);

    const rows: Array<{ name: string; type: string }> = (data ?? []) as any;

    // Group by name + type, count occurrences
    const entityMap = new Map<string, { eventType: string; count: number; names: Set<string> }>();

    for (const row of rows) {
      const key = `${row.name}|${row.type}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { eventType: row.type, count: 0, names: new Set() });
      }
      const entity = entityMap.get(key)!;
      entity.count += 1;
      entity.names.add(row.name);
    }

    // Convert to output format, sort by count descending
    const entities = Array.from(entityMap.entries())
      .map(([key, data]) => ({
        name: key.split('|')[0],
        eventType: data.eventType,
        count: data.count,
        sampleNames: Array.from(data.names).slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, input.limit);

    return {
      entities,
      totalEvents: count ?? 0,
      hasData: entities.length > 0,
    };
  },
});
