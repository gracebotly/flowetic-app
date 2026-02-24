// mastra/lib/patternCache.ts
//
// In-memory LRU cache for BM25 design pattern results.
// Keyed by skeletonId + platformType. TTL of 5 minutes.
// Prevents redundant workspace.search() calls for the same dashboard type.
//
// This is a simple Map-based cache — no external dependencies.
// Safe for Vercel serverless: each cold start gets a fresh cache,
// and warm containers benefit from repeated searches within the TTL.

interface CacheEntry {
  patterns: Array<{ content: string; source: string; score: number }>;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 50;
const cache = new Map<string, CacheEntry>();

/**
 * Get cached BM25 patterns for the given key.
 * Returns null if not found or expired.
 */
export function getCachedPatterns(key: string): CacheEntry['patterns'] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.patterns;
}

/**
 * Store BM25 patterns in the cache.
 * Evicts the oldest entry if the cache is full (LRU).
 */
export function setCachedPatterns(key: string, patterns: CacheEntry['patterns']): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = Array.from(cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { patterns, timestamp: Date.now() });
}

/**
 * Build a deterministic cache key from skeleton + platform identifiers.
 */
export function buildPatternCacheKey(skeletonId: string, platformType: string): string {
  return `${skeletonId}:${platformType}`;
}
