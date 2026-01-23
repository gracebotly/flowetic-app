import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const getClientContext = createTool({
  id: "getClientContext",
  description: "Fetch tenant context: connected sources and last event timestamp per source.",
  inputSchema: z.object({
    tenantId: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    tenantId: z.string().uuid(),
    sources: z.array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        status: z.string().nullable(),
        lastEventTime: z.string().nullable()
      })
    ),
    entities: z.array(
      z.object({
        sourceId: z.string().uuid(),
        entityKind: z.string(),
        externalId: z.string(),
        displayName: z.string(),
        enabledForAnalytics: z.boolean(),
        enabledForActions: z.boolean(),
        lastSeenAt: z.string().nullable()
      })
    )
  }),
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();
    const tenantId = inputData.tenantId ?? runtimeContext?.get("tenantId") ?? void 0;
    if (!tenantId) {
      throw new Error("AUTH_REQUIRED");
    }
    const { data: sources, error: sourcesError } = await supabase.from("sources").select("id,type,status").eq("tenant_id", tenantId);
    if (sourcesError) throw new Error(sourcesError.message);
    const sourceIds = (sources ?? []).map((s) => s.id);
    const { data: entities, error: entitiesError } = await supabase.from("source_entities").select("source_id,entity_kind,external_id,display_name,enabled_for_analytics,enabled_for_actions,last_seen_at").in("source_id", sourceIds);
    if (entitiesError) throw new Error(entitiesError.message);
    const results = [];
    for (const s of sources ?? []) {
      const { data: lastEvent, error: lastEventError } = await supabase.from("events").select("timestamp").eq("tenant_id", tenantId).eq("source_id", s.id).order("timestamp", { ascending: false }).limit(1).maybeSingle();
      if (lastEventError) throw new Error(lastEventError.message);
      results.push({
        id: s.id,
        type: s.type,
        status: s.status ?? null,
        lastEventTime: lastEvent?.timestamp ?? null
      });
    }
    return {
      tenantId,
      sources: results,
      entities: (entities ?? []).map((e) => ({
        sourceId: e.source_id,
        entityKind: e.entity_kind,
        externalId: e.external_id,
        displayName: e.display_name,
        enabledForAnalytics: e.enabled_for_analytics,
        enabledForActions: e.enabled_for_actions,
        lastSeenAt: e.last_seen_at
      }))
    };
  }
});

export { getClientContext };
