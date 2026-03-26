import { createClient } from '@supabase/supabase-js';

// Service role client — portal viewers are unauthenticated
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ResolvedPortal {
  portal: {
    id: string;
    tenant_id: string;
    source_id: string;
    name: string;
    token: string;
    platform_type: string;
    skeleton_id: string;
    branding: Record<string, unknown>;
    status: string;
    client_id: string | null;
    created_at: string;
    expires_at: string | null;
    // V4 additions
    surface_type: string;
    access_type: string;
    // V5 additions — payment gate support
    pricing_type: string | null;
    slug: string | null;
  };
  tenant: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    custom_domain: string | null;
    domain_verified: boolean;
    brand_footer: string | null;
    favicon_url: string | null;
    default_theme: string | null;
    welcome_message: string | null;
  };
  events: Array<{
    id: string;
    type: string;
    name: string | null;
    value: number | null;
    state: Record<string, unknown> | null;
    labels: Record<string, unknown>;
    timestamp: string;
    platform_event_id: string | null;
  }>;
}

/**
 * Resolve a portal/offering by its public token.
 *
 * V4: Now queries the `offerings` table instead of `client_portals`.
 * Uses service role key because portal viewers have no Supabase session.
 * The token IS the auth.
 */
export async function resolvePortal(
  token: string
): Promise<ResolvedPortal | null> {
  // 1. Look up offering by token
  const { data: portal, error: portalError } = await supabaseAdmin
    .from('client_portals')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();

  if (portalError || !portal) {
    console.error('[resolvePortal] Offering not found:', portalError?.message);
    return null;
  }

  // 2. Check expiry
  if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
    console.warn('[resolvePortal] Offering expired:', portal.id);
    return null;
  }

  // 3. Fetch tenant with branding columns
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, name, logo_url, primary_color, secondary_color, custom_domain, domain_verified, brand_footer, favicon_url, default_theme, welcome_message')
    .eq('id', portal.tenant_id)
    .single();

  if (tenantError || !tenant) {
    console.error('[resolvePortal] Tenant not found:', tenantError?.message);
    return null;
  }

  // 4. Fetch events for this offering's source
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, type, name, value, state, labels, timestamp, platform_event_id, source_id')
    .eq('tenant_id', portal.tenant_id)
    .eq('source_id', portal.source_id)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (eventsError) {
    console.error('[resolvePortal] Events fetch error:', eventsError.message);
  }

  // ── 4b. Check if this is a multi-entity portal FIRST ─────────
  // We need to know this before deciding whether to apply single-entity filtering.
  // If portal_entities has rows, this is a multi-entity portal and step 4c
  // will handle ALL filtering. We must NOT narrow events here or step 4c
  // will receive an already-filtered set missing the other entities' events.
  let filteredEvents = events ?? [];

  const { data: offeringEntities } = await supabaseAdmin
    .from('portal_entities')
    .select('source_id, entity_id')
    .eq('portal_id', portal.id);

  const isMultiEntity = offeringEntities && offeringEntities.length > 0;

  // Only apply single-entity filter for portals WITHOUT portal_entities rows.
  // Multi-entity portals are handled entirely by step 4c below.
  if (!isMultiEntity && portal.entity_id) {
    const { data: entity } = await supabaseAdmin
      .from('source_entities')
      .select('external_id')
      .eq('id', portal.entity_id)
      .single();

    if (entity?.external_id) {
      filteredEvents = filteredEvents.filter((e) => {
        const state = (e.state as Record<string, unknown>) ?? {};
        const platform = String(state.platform ?? '');
        const pt = portal.platform_type ?? '';

        if (platform === 'vapi' || platform === 'retell' || pt === 'vapi' || pt === 'retell') {
          // Voice events: check workflow_id first (canonical field set by import),
          // then fall back to assistant_id / agent_id for legacy data
          const voiceId = String(state.workflow_id ?? state.assistant_id ?? state.agent_id ?? '');
          if (!voiceId || voiceId === 'undefined' || voiceId === 'null') return true;
          return voiceId === entity.external_id;
        }

        const wfId = String(state.workflow_id ?? '');
        if (!wfId || wfId === 'undefined' || wfId === 'null') return true;
        return wfId === entity.external_id;
      });
    }
  }

  // ── 4b-synth. Synthesize events from aggregate_stats when no real events exist ──
  // This handles webhook-triggered Make scenarios where individual execution logs
  // are not available but the platform provides aggregate totals.
  if (!isMultiEntity && filteredEvents.length === 0 && portal.entity_id) {
    const { data: entityWithStats } = await supabaseAdmin
      .from('source_entities')
      .select('external_id, display_name, aggregate_stats')
      .eq('id', portal.entity_id)
      .single();

    const stats = entityWithStats?.aggregate_stats as Record<string, unknown> | null;
    const rawExecs = Number(stats?.total_executions ?? stats?.total_operations ?? 0);
    if (stats && rawExecs > 0) {
      const totalExecs = rawExecs;
      const totalErrors = (stats.total_errors as number) ?? 0;
      const totalOps = (stats.total_operations as number) ?? 0;
      const totalCenticredits = (stats.total_centicredits as number) ?? 0;
      const totalTransfer = (stats.data_transfer_bytes as number) ?? 0;

      // Create a single synthetic summary event that transformWorkflowData can consume.
      // It won't produce per-execution rows or trends, but it will populate
      // headline, KPIs, health status, and resource metrics.
      const synthEvent = {
        id: `synth-aggregate-${portal.entity_id}`,
        type: 'scenario_execution_summary',
        name: `make:${entityWithStats?.display_name ?? 'scenario'}:aggregate`,
        value: totalExecs - totalErrors,
        state: {
          workflow_id: entityWithStats?.external_id ?? '',
          workflow_name: entityWithStats?.display_name ?? 'Scenario',
          status: 'success',
          platform: 'make',
          is_aggregate: true,
          aggregate_total: totalExecs,
          aggregate_errors: totalErrors,
          aggregate_success: totalExecs - totalErrors,
          operations_used: totalOps,
          centicredits: totalCenticredits,
          data_transfer_bytes: totalTransfer,
          duration_ms: 0,
        },
        labels: {
          scenario_id: entityWithStats?.external_id ?? '',
          platformType: 'make',
        },
        timestamp: (stats.updated_at as string) ?? new Date().toISOString(),
        platform_event_id: null,
      };

      filteredEvents = [synthEvent as typeof filteredEvents[number]];
    }
  }

  // ── 4c. Multi-entity portals (portal_entities) ───────────
  // Handles both:
  //   a) Cross-source: entities from different platform connections
  //   b) Same-source: multiple entities (e.g. 3 Make scenarios) from the same connection
  // NOTE: offeringEntities was already fetched in step 4b above.
  if (isMultiEntity && offeringEntities) {
    // Fetch external_ids for ALL entities in this portal
    const allEntityIds = offeringEntities.map((oe) => String(oe.entity_id));
    const { data: allEntityRecords } = await supabaseAdmin
      .from('source_entities')
      .select('id, external_id, source_id')
      .in('id', allEntityIds);

    if (allEntityRecords && allEntityRecords.length > 0) {
      const allowedExternalIds = new Set(
        allEntityRecords.map((er) => er.external_id as string)
      );

      // Fetch extra events from source IDs not yet loaded (cross-source portals)
      const extraSourceIds = [...new Set(
        allEntityRecords
          .map((er) => er.source_id as string)
          .filter((sid): sid is string => typeof sid === 'string' && sid !== portal.source_id)
      )];

      const extraEvents: typeof filteredEvents = [];
      for (const sid of extraSourceIds) {
        const { data: srcEvents } = await supabaseAdmin
          .from('events')
          .select('id, type, name, value, state, labels, timestamp, platform_event_id, source_id')
          .eq('tenant_id', portal.tenant_id)
          .eq('source_id', sid)
          .order('timestamp', { ascending: false })
          .limit(200);
        extraEvents.push(...(srcEvents ?? []));
      }

      // Determine source types for voice ID detection
      const sourceIds = [...new Set(allEntityRecords.map((er) => er.source_id as string))];
      const { data: sourceRecords } = await supabaseAdmin
        .from('sources')
        .select('id, type')
        .in('id', sourceIds);
      const sourceTypeMap = new Map(
        (sourceRecords ?? []).map((s) => [s.id as string, s.type as string])
      );

      // Combine primary + extra events, then filter to only allowed entities
      const combined = [...filteredEvents, ...extraEvents];
      filteredEvents = combined.filter((e) => {
        const state = (e.state as Record<string, unknown>) ?? {};
        const platform = String(state.platform ?? '');
        const sourceType = sourceTypeMap.get(String((e as { source_id?: string }).source_id ?? ''));

        // Voice events: agent ID is stored in state.workflow_id (normalized by import routes)
        if (platform === 'vapi' || platform === 'retell' || sourceType === 'vapi' || sourceType === 'retell') {
          const voiceId = String(state.workflow_id ?? state.assistant_id ?? state.agent_id ?? '');
          if (!voiceId || voiceId === 'undefined' || voiceId === 'null') return true;
          return allowedExternalIds.has(voiceId);
        }

        // Workflow events: workflow_id is the canonical ID
        const wfId = String(state.workflow_id ?? '');
        if (!wfId || wfId === 'undefined' || wfId === 'null') return true;
        return allowedExternalIds.has(wfId);
      });
    }
  }

  // 5. Update last_viewed_at (fire-and-forget)
  supabaseAdmin
    .from('client_portals')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', portal.id)
    .then(({ error }) => {
      if (error) console.warn('[resolvePortal] Failed to update last_viewed_at:', error.message);
    });

  // Patch platform_type from source if portal has null (legacy portals)
  if (!portal.platform_type) {
    const { data: source } = await supabaseAdmin
      .from('sources')
      .select('type')
      .eq('id', portal.source_id)
      .single();
    if (source?.type) {
      (portal as Record<string, unknown>).platform_type = source.type;
    }
  }

  return {
    portal,
    tenant,
    events: filteredEvents,
  };
}
