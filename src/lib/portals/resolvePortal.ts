import { createClient } from '@supabase/supabase-js';

// Service role client — portal viewers are unauthenticated
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PortalBranding {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  custom_domain: string | null;
  // Plus any overrides from client_portals.branding JSONB
  [key: string]: unknown;
}

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
 * Resolve a portal by its public token.
 *
 * Uses service role key because portal viewers have no Supabase session.
 * The token IS the auth — validated here + RLS allows anon SELECT on active portals.
 */
export async function resolvePortal(
  token: string
): Promise<ResolvedPortal | null> {
  // 1. Look up portal by token
  const { data: portal, error: portalError } = await supabaseAdmin
    .from('client_portals')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();

  if (portalError || !portal) {
    console.error('[resolvePortal] Portal not found:', portalError?.message);
    return null;
  }

  // 2. Check expiry
  if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
    console.warn('[resolvePortal] Portal expired:', portal.id);
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

  // 4. Fetch events for this portal's source
  //    Table: events (NOT platform_events)
  //    Columns: id, type, name, value, state (jsonb), labels (jsonb),
  //             timestamp, platform_event_id
  //    Filtered by: source_id matching portal.source_id
  //    Ordered by: timestamp DESC (most recent first)
  //    Limit: 500 (sufficient for 30d at typical volumes)
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, type, name, value, state, labels, timestamp, platform_event_id')
    .eq('source_id', portal.source_id)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (eventsError) {
    console.error('[resolvePortal] Events fetch error:', eventsError.message);
    // Don't fail — return portal with empty events
  }

  // 5. Update last_viewed_at (fire-and-forget)
  supabaseAdmin
    .from('client_portals')
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
