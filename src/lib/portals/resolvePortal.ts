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
  };
  tenant: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    custom_domain: string | null;
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
    .select('id, name, logo_url, primary_color, secondary_color, custom_domain, brand_footer, favicon_url, default_theme, welcome_message')
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

  // ── 4b. Filter events to this entity ────────────────────────
  let filteredEvents = events ?? [];

  if (portal.entity_id) {
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
          const voiceId = String(state.assistant_id ?? state.agent_id ?? '');
          // If voiceId is empty/missing, fall through — source_id scoping is sufficient
          if (!voiceId || voiceId === 'undefined' || voiceId === 'null') return true;
          return voiceId === entity.external_id;
        }

        const wfId = String(state.workflow_id ?? '');
        // Same fallback for workflows
        if (!wfId || wfId === 'undefined' || wfId === 'null') return true;
        return wfId === entity.external_id;
      });
    }
  }

  // ── 4c. Multi-entity portals (offering_entities) ───────────
  const { data: offeringEntities } = await supabaseAdmin
    .from('portal_entities')
    .select('source_id, entity_id')
    .eq('portal_id', portal.id);

  if (offeringEntities && offeringEntities.length > 0) {
    const extraEvents: typeof filteredEvents = [];
    const extraSourceIds = [...new Set(
      offeringEntities
        .map((oe) => oe.source_id)
        .filter((sid): sid is string => typeof sid === 'string' && sid !== portal.source_id)
    )];

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

    if (extraEvents.length > 0) {
      const entityIds = offeringEntities.map((oe) => String(oe.entity_id));
      const { data: entityRecords } = await supabaseAdmin
        .from('source_entities')
        .select('id, external_id, source_id')
        .in('id', entityIds);

      const sourceIds = [...new Set((entityRecords ?? []).map((er) => er.source_id))];
      const { data: sourceRecords } = await supabaseAdmin
        .from('sources')
        .select('id, type')
        .in('id', sourceIds);

      const sourceTypeMap = new Map(
        (sourceRecords ?? []).map((s) => [s.id as string, s.type as string])
      );

      if (entityRecords) {
        const allowedExternalIds = new Set(
          entityRecords.map((er) => er.external_id as string)
        );

        const combined = [...filteredEvents, ...extraEvents];
        filteredEvents = combined.filter((e) => {
          const state = (e.state as Record<string, unknown>) ?? {};
          const platform = String(state.platform ?? '');

          if (platform === 'vapi' || platform === 'retell') {
            const voiceId = String(state.assistant_id ?? state.agent_id ?? '');
            return allowedExternalIds.has(voiceId);
          }

          const sourceType = sourceTypeMap.get(String((e as { source_id?: string }).source_id ?? ''));
          if (sourceType === 'vapi' || sourceType === 'retell') {
            const voiceId = String(state.assistant_id ?? state.agent_id ?? '');
            return allowedExternalIds.has(voiceId);
          }

          const wfId = String(state.workflow_id ?? '');
          return allowedExternalIds.has(wfId);
        });
      }
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
