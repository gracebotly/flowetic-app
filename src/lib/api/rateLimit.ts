import { createClient } from '@supabase/supabase-js';

/**
 * Supabase-backed rate limiter.
 *
 * Uses the `check_rate_limit` RPC function which atomically increments
 * a counter in the `rate_limits` table. Persists across Vercel serverless
 * cold starts — unlike in-memory Maps which reset on every cold boot.
 *
 * Adds ~20ms per check (one Supabase RPC call).
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_ms: number;
}

/**
 * Check rate limit for a given key.
 *
 * @param key - Unique identifier (e.g., "checkout:192.168.1.1")
 * @param windowSeconds - Time window in seconds (default: 60)
 * @param maxHits - Max requests per window (default: 10)
 */
export async function checkRateLimit(
  key: string,
  windowSeconds = 60,
  maxHits = 10
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max_hits: maxHits,
    });

    if (error) {
      // If rate limiter fails, allow the request (fail open)
      console.error('[rateLimit] RPC error:', error.message);
      return { allowed: true, remaining: maxHits, reset_ms: 0 };
    }

    return data as RateLimitResult;
  } catch (err) {
    // Fail open — don't block legitimate users if Supabase is down
    console.error('[rateLimit] Unexpected error:', err);
    return { allowed: true, remaining: maxHits, reset_ms: 0 };
  }
}

/**
 * Extract client IP from a Request object.
 * Vercel sets x-forwarded-for; falls back to x-real-ip.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
