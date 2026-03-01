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
    .from('offerings')
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
    .select('id, name, logo_url, primary_color, secondary_color, custom_domain')
    .eq('id', portal.tenant_id)
    .single();

  if (tenantError || !tenant) {
    console.error('[resolvePortal] Tenant not found:', tenantError?.message);
    return null;
  }

  // 4. Fetch events for this offering's source
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, type, name, value, state, labels, timestamp, platform_event_id')
    .eq('source_id', portal.source_id)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (eventsError) {
    console.error('[resolvePortal] Events fetch error:', eventsError.message);
  }

  // 5. Update last_viewed_at (fire-and-forget)
  supabaseAdmin
    .from('offerings')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', portal.id)
    .then(({ error }) => {
      if (error) console.warn('[resolvePortal] Failed to update last_viewed_at:', error.message);
    });

  return {
    portal,
    tenant,
    events: events ?? [],
  };
}
