/**
 * Edge-compatible path lookup for clean URL resolution.
 *
 * Given a tenant_id (from domain lookup) and a custom_path (from URL),
 * resolves to the internal portal token or product slug.
 *
 * Used by middleware to rewrite:
 *   portal.smith.agency/invoice-tracker → /client/invoice-tracker-28nph
 *   portal.smith.agency/lead-qualifier  → /p/lead-qualifier-ai
 *
 * Same pattern as edgeTenantLookup.ts — PostgREST + Map cache.
 */

export interface ResolvedPath {
  /** 'magic_link' portals rewrite to /client/[token], 'stripe_gate' to /p/[slug] */
  access_type: 'magic_link' | 'stripe_gate';
  token: string | null;
  slug: string | null;
}

interface CachedPath {
  resolved: ResolvedPath;
  expires: number;
}

// In-memory cache — survives warm edge isolate starts
const pathCache = new Map<string, CachedPath>();
const CACHE_TTL_MS = 60_000; // 60 seconds

// Negative cache — avoid hammering DB for unknown paths
const negativeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Look up a portal by its custom_path within a specific tenant.
 * Returns the access_type + token/slug needed for middleware rewriting.
 *
 * @param tenantId - The tenant_id (already resolved from domain lookup)
 * @param customPath - The first path segment from the URL (e.g., "invoice-tracker")
 * @returns ResolvedPath if found, null if no matching portal
 */
export async function resolvePathOnDomain(
  tenantId: string,
  customPath: string
): Promise<ResolvedPath | null> {
  const cacheKey = `${tenantId}:${customPath}`;

  // Check positive cache
  const cached = pathCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return cached.resolved;
  }

  // Check negative cache
  const negCached = negativeCache.get(cacheKey);
  if (negCached && Date.now() < negCached) {
    return null;
  }

  // Direct PostgREST call — edge compatible
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[edgePathLookup] Missing SUPABASE env vars');
    return null;
  }

  try {
    const url = new URL('/rest/v1/client_portals', supabaseUrl);
    url.searchParams.set('select', 'access_type,token,slug');
    url.searchParams.set('tenant_id', `eq.${tenantId}`);
    url.searchParams.set('custom_path', `eq.${customPath}`);
    url.searchParams.set('status', 'eq.active');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.error('[edgePathLookup] PostgREST error:', res.status);
      return null;
    }

    const rows: Array<{
      access_type: string;
      token: string | null;
      slug: string | null;
    }> = await res.json();

    if (rows.length === 0) {
      negativeCache.set(cacheKey, Date.now() + NEGATIVE_CACHE_TTL_MS);
      return null;
    }

    const row = rows[0];
    const resolved: ResolvedPath = {
      access_type: row.access_type as 'magic_link' | 'stripe_gate',
      token: row.token,
      slug: row.slug,
    };

    // Cache positive result
    pathCache.set(cacheKey, {
      resolved,
      expires: Date.now() + CACHE_TTL_MS,
    });

    return resolved;
  } catch (err) {
    console.error('[edgePathLookup] Fetch failed:', err);
    return null;
  }
}
