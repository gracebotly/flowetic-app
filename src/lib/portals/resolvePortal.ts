import { createClient } from '@supabase/supabase-js';

export interface ResolvedPortal {
  portal: {
    id: string;
    name: string;
    token: string;
    source_id: string;
    platform_type: string;
    skeleton_id: string;
    status: string;
    branding: Record<string, unknown>;
  };
  tenant: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
  };
  events: Array<{
    id: string;
    type: string;
    state: Record<string, unknown>;
    labels: Record<string, unknown>;
    timestamp: string;
    created_at: string;
  }>;
}

/**
 * Resolve a portal token to full portal data.
 * Used by /client/[token] route — NO AUTH REQUIRED.
 * The token IS the auth.
 * 
 * Uses service role key because the client viewer has no Supabase session.
 */
export async function resolvePortal(token: string): Promise<ResolvedPortal | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  // Service role client — bypasses RLS
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Look up portal by token
  const { data: portal, error: portalErr } = await supabase
    .from('client_portals')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .maybeSingle();

  if (portalErr || !portal) return null;

  // Check expiration
  if (portal.expires_at && new Date(portal.expires_at) < new Date()) return null;

  // 2. Get tenant branding
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, logo_url, primary_color, secondary_color')
    .eq('id', portal.tenant_id)
    .single();

  if (!tenant) return null;

  // 3. Fetch events for this portal's source
  const { data: events } = await supabase
    .from('platform_events')
    .select('id, type, state, labels, timestamp, created_at')
    .eq('tenant_id', portal.tenant_id)
    .eq('source_id', portal.source_id)
    .order('timestamp', { ascending: false })
    .limit(500);

  // 4. Update last_viewed_at
  await supabase
    .from('client_portals')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', portal.id);

  return {
    portal: {
      id: portal.id,
      name: portal.name,
      token: portal.token,
      source_id: portal.source_id,
      platform_type: portal.platform_type,
      skeleton_id: portal.skeleton_id,
      status: portal.status,
      branding: portal.branding || {},
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color || '#3B82F6',
      secondary_color: tenant.secondary_color || '#1E40AF',
    },
    events: events || [],
  };
}
