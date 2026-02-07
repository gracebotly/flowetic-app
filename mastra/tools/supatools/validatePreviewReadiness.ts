


import { createSupaTool } from '../_base';
import { createAuthenticatedClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
  sourceId: z.string().uuid().optional(),
  requireMinEvents: z.number().min(1).default(2),
  requireSchemaReady: z.boolean().default(true),
});



const outputSchema = z.object({
  ready: z.boolean(),
  canProceed: z.boolean(),
  checks: z.object({
    hasSource: z.object({ passed: z.boolean(), message: z.string() }),
    hasEvents: z.object({ passed: z.boolean(), message: z.string(), count: z.number() }),
    journeySession: z.object({ passed: z.boolean(), message: z.string() }),
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
  execute: async (rawInput: unknown, context) => {
    const input = inputSchema.parse(rawInput);

    // Get access token
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[validatePreviewReadiness]: Missing authentication');
    }

    // ✅ Get tenantId from VALIDATED context, not input
    const tenantId = context.requestContext?.get('tenantId');

    if (!tenantId) {
      throw new Error('validatePreviewReadiness: tenantId missing from request context');
    }

    const { sourceId, requireMinEvents, requireSchemaReady } = input;

    const supabase = createAuthenticatedClient(accessToken);
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Build source query - if sourceId provided, look up that specific source.
    // If not, find any active source for this tenant.
    let sourceQuery = supabase
      .from('sources')
      .select('id, name, status')
      .eq('tenant_id', tenantId);

    if (sourceId) {
      sourceQuery = sourceQuery.eq('id', sourceId);
    } else {
      sourceQuery = sourceQuery.eq('status', 'active');
    }

    const { data: sources, error: sourceError } = await sourceQuery.limit(1);

    const source = !sourceError && sources && sources.length > 0 ? sources[0] : undefined;
    
    if (!source) {
      blockers.push('No active source found. Connect a platform source before generating preview.');
    } else if (source.status !== 'active') {
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
    const eventTypes = new Set(events?.map((e: any) => e.type as string) || []);
    const uniqueEventTypes = Array.from(eventTypes);
    
    if (eventsError) {
      blockers.push(`Failed to query events: ${eventsError.message}`);
    } else if (eventCount < requireMinEvents) {
      blockers.push(`Insufficient events (${eventCount} < ${requireMinEvents}). Collect more data before generating preview.`);
    }
    
    const { data: session, error: sessionError } = await supabase
      .from('journey_sessions')
      .select(
        'id, mode, source_id, entity_id, selected_outcome, selected_storyboard, selected_style_bundle_id, preview_interface_id, preview_version_id, updated_at'
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      warnings.push(`Could not verify journey session readiness: ${sessionError.message}`);
    }

    // Conservative readiness: require at least a session and a selected source.
    if (requireSchemaReady) {
      if (!session) {
        blockers.push('No journey session found. Start the journey before generating a preview.');
      } else if (!session.source_id) {
        blockers.push('No source selected in the current journey session.');
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
          passed: !!source && source.status === 'active',
          message: source ? `Source "${source.name}" is active` : 'No active source',
        },
        hasEvents: {
          passed: eventCount >= requireMinEvents,
          message: `${eventCount} events (minimum: ${requireMinEvents})`,
          count: eventCount,
        },
        journeySession: {
          passed: !requireSchemaReady ? true : !!session?.source_id,
          message: session
            ? `session mode=${session.mode ?? '(unknown)'} sourceSelected=${!!session.source_id}`
            : 'No session',
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




