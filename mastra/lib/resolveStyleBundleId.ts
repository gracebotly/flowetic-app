/**
 * Resolves a style bundle display name or slug to a valid DB slug.
 *
 * Layered matching strategy:
 *   1. Exact key match (e.g. "neon-cyber")
 *   2. Display name match, case-insensitive (e.g. "Neon Cyber" → "neon-cyber")
 *   3. Slugification ("Modern SaaS" → "modern-saas")
 *   4. Fuzzy word-overlap (requires ≥2 matching words)
 *
 * Returns null when confidence is too low, so callers can skip the DB write
 * and avoid violating the CHECK constraint "valid_style_bundle_id".
 */

const STYLE_BUNDLE_MAP: Record<string, { displayName: string }> = {
  'professional-clean': { displayName: 'Professional Clean' },
  'premium-dark':       { displayName: 'Premium Dark' },
  'glass-premium':      { displayName: 'Glass Premium' },
  'bold-startup':       { displayName: 'Bold Startup' },
  'corporate-trust':    { displayName: 'Corporate Trust' },
  'neon-cyber':         { displayName: 'Neon Cyber' },
  'pastel-soft':        { displayName: 'Pastel Soft' },
  'warm-earth':         { displayName: 'Warm Earth' },
  'modern-saas':        { displayName: 'Modern SaaS' },
};

const VALID_SLUGS = Object.keys(STYLE_BUNDLE_MAP);
const DISPLAY_NAMES = Object.entries(STYLE_BUNDLE_MAP).map(([slug, v]) => ({
  slug,
  displayName: v.displayName,
}));

export function resolveStyleBundleId(input: string): string | null {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Layer 1: Exact key match (already a valid slug)
  if (STYLE_BUNDLE_MAP[trimmed]) return trimmed;
  if (STYLE_BUNDLE_MAP[lower]) return lower;

  // Layer 2: Exact display name match (case-insensitive)
  for (const { slug, displayName } of DISPLAY_NAMES) {
    if (displayName.toLowerCase() === lower) return slug;
  }

  // Layer 3: Slugification ("Modern SaaS" → "modern-saas")
  const slugified = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (STYLE_BUNDLE_MAP[slugified]) return slugified;

  // Layer 4: Word-overlap — requires ≥2 matching words to avoid false positives
  const inputWords = lower.replace(/[-_&]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const slug of VALID_SLUGS) {
    const keyWords = slug.replace(/-/g, ' ').split(/\s+/);
    const displayWords = (STYLE_BUNDLE_MAP[slug]?.displayName || '').toLowerCase().split(/\s+/);
    const candidateWords = [...new Set([...keyWords, ...displayWords])];

    const score = inputWords.filter(w =>
      candidateWords.some(cw => cw.includes(w) || w.includes(cw))
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = slug;
    }
  }

  if (bestScore >= 2 && bestMatch) return bestMatch;

  // No match found — log detailed debug info
  console.warn('[resolveStyleBundleId] Failed to resolve style bundle:', {
    input,
    inputLower: lower,
    slugified,
    availableSlugs: VALID_SLUGS,
    availableDisplayNames: DISPLAY_NAMES.map(d => d.displayName),
  });
  return null;
}
