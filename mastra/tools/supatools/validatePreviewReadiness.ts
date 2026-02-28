


import { createSupaTool } from '../_base';
import { createAuthenticatedClient } from '../../lib/supabase';
import { z } from 'zod';

const inputSchema = z.object({
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
  description: 'Validate all prerequisites before preview generation. Checks source, events, schema readiness, and event type coverage. Returns blockers and warnings. sourceId is read automatically from server context — do NOT pass any IDs.',
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

    const { requireMinEvents, requireSchemaReady } = input;

    // ✅ SECURITY: sourceId comes from RequestContext (server-validated), NEVER from LLM input.
    // The agent previously passed tenantId as sourceId, causing false "No active source" failures.
    // RequestContext.sourceId is set in api/chat/route.ts from the journey_session DB record.
    const sourceId = context.requestContext?.get('sourceId') as string | undefined;

    if (!sourceId) {
      throw new Error(
        'validatePreviewReadiness: sourceId missing from RequestContext. ' +
        'The journey session must have a source_id set before preview readiness can be checked. ' +
        'This is set during entity selection in the propose phase.'
      );
    }

    console.log('[validatePreviewReadiness] Using sourceId from RequestContext:', sourceId);

    const supabase = createAuthenticatedClient(accessToken);
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Source query — always scoped to the specific sourceId from RequestContext.
    // No fallback to "find any active source" — that path caused the agent to discover
    // unrelated sources and get confused.
    let sourceQuery = supabase
      .from('sources')
      .select('id, name, status')
      .eq('tenant_id', tenantId)
      .eq('id', sourceId);

    const { data: sources, error: sourceError } = await sourceQuery.limit(1);

    const source = !sourceError && sources && sources.length > 0 ? sources[0] : undefined;
    
    if (!source) {
      blockers.push('No active source found. Connect a platform source before generating preview.');
    } else if (source.status !== 'active') {
      blockers.push(`Source "${source.name}" is ${source.status}. Activate the source before generating preview.`);
    }
    
    // Check 2: Has minimum events
    // Events scoped to sourceId AND selectedWorkflowName (if available).
    // Without workflow scoping, a source with 3 workflows returns combined counts,
    // contradicting getEventStats which DOES scope by workflow.
    let eventsQuery = supabase
      .from('events')
      .select('id, type')
      .eq('tenant_id', tenantId)
      .eq('source_id', sourceId);

    // ✅ FIX: Scope to selected workflow to match getEventStats behavior
    const selectedWorkflowName = context.requestContext?.get('selectedWorkflowName') as string | undefined;
    if (selectedWorkflowName) {
      eventsQuery = eventsQuery.eq('state->>workflow_name', selectedWorkflowName);
      console.log(`[validatePreviewReadiness] Scoping events to workflow: "${selectedWorkflowName}"`);
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
        // ❌ REMOVED BLOCKER: Journey sessions are created during journey, not before
        // blockers.push('No journey session found. Start the journey before generating a preview.');
      } else if (!session.source_id) {
        blockers.push('No source selected in the current journey session.');
      }
    }
    
    // Check 4: Event types coverage
    if (uniqueEventTypes.length === 0) {
      warnings.push('No event types detected. Dashboard may be empty.');
    } else if (uniqueEventTypes.length === 1) {
      warnings.push(
        `Limited event diversity: only "${uniqueEventTypes[0]}" events detected. ` +
        `For richer insights, ensure workflow includes diverse actions (lead creation, metric updates, stage transitions, etc.).`
      );
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



