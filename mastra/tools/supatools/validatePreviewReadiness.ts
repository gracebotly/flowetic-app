


import { createSupaTool } from './_base';
import { createClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  requireMinEvents: z.number().min(1).default(10),
  requireSchemaReady: z.boolean().default(true),
});

const outputSchema = z.object({
  ready: z.boolean(),
  canProceed: z.boolean(),
  checks: z.object({
    hasSource: z.object({ passed: z.boolean(), message: z.string() }),
    hasEvents: z.object({ passed: z.boolean(), message: z.string(), count: z.number() }),
    schemaReady: z.object({ passed: z.boolean(), message: z.string() }),
    eventTypes: z.object({ passed: z.boolean(), message: z.string(), types: z.array(z.string()) }),
  }),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const validatePreviewReadiness = createSupaTool<z.infer<typeof outputSchema>>({
  id: 'validatePreviewReadiness',
  description: 'Validate all prerequisites before preview generation. Checks source, events, schema readiness, and event type coverage. Returns blockers and warnings. Use before Phase 4 to prevent failed workflows.',
  inputSchema,
  outputSchema,

  execute: async (rawInput: unknown) => {
    const input = inputSchema.parse(rawInput);
    const { tenantId, sourceId, requireMinEvents, requireSchemaReady } = input;

    const supabase = createClient();
    const blockers: string[] = [];
    const warnings: string[] = [];

    const { data: sources, error: sourceError } = await supabase
      .from('sources')
      .select('id, name, status')
      .eq('tenant_id', tenantId)
      .eq(sourceId ? 'id' : 'tenant_id', sourceId ?? tenantId)
      .limit(1);

    const hasSource = !sourceError && sources && sources.length > 0;
    const source = sources?.[0];
    
    if (!hasSource) {
      blockers.push('No active source found. Connect a platform source before generating preview.');
    } else if (source?.status !== 'active') {
      blockers.push(`Source "${source.name}" is ${source.status}. Activate the source before generating preview.`);
    }
    
    // Check 2: Has minimum events
    let eventsQuery = supabase
      .from('events')
      .select('id, type')
      .eq('tenant_id', tenantId);
    
    if (sourceId) {
      eventsQuery = eventsQuery.eq('source_id', sourceId);
    }
    
    const { data: events, error: eventsError } = await eventsQuery;
    
    const eventCount = events?.length || 0;
    const eventTypes = new Set(events?.map(e => e.type) || []);
    const uniqueEventTypes = Array.from(eventTypes);
    
    if (eventsError) {
      blockers.push(`Failed to query events: ${eventsError.message}`);
    } else if (eventCount < requireMinEvents) {
      blockers.push(`Insufficient events (${eventCount} < ${requireMinEvents}). Collect more data before generating preview.`);
    }
    
    // Check 3: Schema ready (via journey_sessions table)
    const { data: journey, error: journeyError } = await supabase
      .from('journey_sessions')
      .select('id, schema_ready')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    let schemaReady = journey?.schema_ready ?? false;
    
    if (requireSchemaReady) {
      if (journeyError) {
        warnings.push('Could not verify schema readiness. Proceed with caution.');
        schemaReady = true; // Default to true if unable to check
      } else if (!schemaReady) {
        blockers.push('Schema not ready. Run connection backfill workflow first.');
      }
    }
    
    // Check 4: Event types coverage
    if (uniqueEventTypes.length === 0) {
      warnings.push('No event types detected. Dashboard may be empty.');
    } else if (uniqueEventTypes.length === 1) {
      warnings.push(`Only "${uniqueEventTypes[0]}" event type detected. Consider waiting for more event types.`);
    } else if (!uniqueEventTypes.includes('metric')) {
      warnings.push('No metric events detected. Dashboard may lack quantitative data.');
    }
    
    // Final verdict
    const ready = blockers.length === 0;
    const canProceed = ready && warnings.length < 3;
    
    return {
      ready,
      canProceed,
      checks: {
        hasSource: {
          passed: hasSource && source?.status === 'active',
          message: hasSource ? `Source "${source?.name}" is active` : 'No active source',
        },
        hasEvents: {
          passed: eventCount >= requireMinEvents,
          message: `${eventCount} events (minimum: ${requireMinEvents})`,
          count: eventCount,
        },
        schemaReady: {
          passed: schemaReady || !requireSchemaReady,
          message: schemaReady ? 'Schema is ready' : 'Schema not ready',
        },
        eventTypes: {
          passed: uniqueEventTypes.length >= 2,
          message: `${uniqueEventTypes.length} unique event types: ${uniqueEventTypes.join(', ')}`,
          types: uniqueEventTypes,
        },
      },
      blockers,
      warnings,
    };
  },
});




