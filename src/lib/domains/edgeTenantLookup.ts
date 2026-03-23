/**
 * Edge-compatible tenant lookup by custom domain.
 *
 * Middleware runs at the Vercel edge — no full Supabase client available.
 * This uses a direct PostgREST REST call with the service role key.
 *
 * Includes a 60-second Map cache within the edge isolate to avoid
 * hitting Supabase on every request. Cache survives warm starts.
 * Cache miss = ~50ms Supabase REST call. Cache hit = 0ms.
 */

interface CachedTenant {
  tenant_id: string;
  expires: number;
}

// In-memory cache — survives warm edge isolate starts
const domainCache = new Map<string, CachedTenant>();
const CACHE_TTL_MS = 60_000; // 60 seconds

// Negative cache — avoid hammering DB for unknown domains
const negativeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Look up a tenant by their verified custom domain.
 * Returns the tenant_id if found, null if not.
 *
 * Uses direct Supabase REST API (PostgREST) — edge compatible.
 */
export async function lookupTenantByDomain(
  hostname: string
): Promise<string | null> {
  // Check positive cache
  const cached = domainCache.get(hostname);
  if (cached && Date.now() < cached.expires) {
    return cached.tenant_id;
  }

  // Check negative cache (domain we already know doesn't exist)
  const negCached = negativeCache.get(hostname);
  if (negCached && Date.now() < negCached) {
    return null;
  }

  // Direct PostgREST call — edge compatible
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[edgeTenantLookup] Missing SUPABASE env vars');
    return null;
  }

  try {
    const url = new URL('/rest/v1/tenants', supabaseUrl);
    url.searchParams.set('select', 'id');
    url.searchParams.set('custom_domain', `eq.${hostname}`);
    url.searchParams.set('domain_verified', 'eq.true');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.error('[edgeTenantLookup] PostgREST error:', res.status);
      return null;
    }

    const rows: Array<{ id: string }> = await res.json();

    if (rows.length === 0) {
      // Cache negative result
      negativeCache.set(hostname, Date.now() + NEGATIVE_CACHE_TTL_MS);
      return null;
    }

    const tenantId = rows[0].id;

    // Cache positive result
    domainCache.set(hostname, {
      tenant_id: tenantId,
      expires: Date.now() + CACHE_TTL_MS,
    });

    return tenantId;
  } catch (err) {
    console.error('[edgeTenantLookup] Fetch failed:', err);
    return null;
  }
}
