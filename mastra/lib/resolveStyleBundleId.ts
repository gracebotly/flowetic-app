/**
 * Resolves a style bundle display name or slug to a valid DB slug.
 *
 * Layered matching strategy:
 *   1. Exact key match (e.g. "neon-cyber")
 *   2. Display name match, case-insensitive (e.g. "Neon Cyber" → "neon-cyber")
 *   3. Slugification ("Modern SaaS" → "modern-saas")
 *   4. Fuzzy word-overlap (requires ≥2 matching words)
 *
 * Returns null when confidence is too low, so callers can skip the DB write.
 * This prevents CHECK constraint "valid_style_bundle_id" violations caused by
 * raw display names being stored instead of canonical slugs.
 */

const VALID_STYLE_BUNDLE_SLUGS: readonly string[] = [
  'professional-clean',
  'premium-dark',
  'glass-premium',
  'bold-startup',
  'corporate-trust',
  'neon-cyber',
  'pastel-soft',
  'warm-earth',
  'modern-saas',
];

const STYLE_DISPLAY_NAMES: Record<string, string> = {
  'professional-clean': 'Professional Clean',
  'premium-dark': 'Premium Dark',
  'glass-premium': 'Glass Premium',
  'bold-startup': 'Bold Startup',
  'corporate-trust': 'Corporate Trust',
  'neon-cyber': 'Neon Cyber',
  'pastel-soft': 'Pastel Soft',
  'warm-earth': 'Warm Earth',
  'modern-saas': 'Modern SaaS',
};

export function resolveStyleBundleId(input: string): string | null {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Layer 1: Exact key match (already a valid slug)
  if ((VALID_STYLE_BUNDLE_SLUGS as string[]).includes(trimmed)) return trimmed;
  if ((VALID_STYLE_BUNDLE_SLUGS as string[]).includes(lower)) return lower;

  // Layer 2: Exact display name match (case-insensitive)
  for (const [key, displayName] of Object.entries(STYLE_DISPLAY_NAMES)) {
    if (displayName.toLowerCase() === lower) return key;
  }

  // Layer 3: Slugification ("Modern SaaS" → "modern-saas")
  const slugified = lower.replace(/\s+/g, '-');
  if ((VALID_STYLE_BUNDLE_SLUGS as string[]).includes(slugified)) return slugified;

  // Layer 4: Word-overlap — requires ≥2 matching words to avoid false positives
  const inputWords = lower.replace(/[-_&]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const key of VALID_STYLE_BUNDLE_SLUGS) {
    const keyWords = key.replace(/-/g, ' ').split(/\s+/);
    const displayWords = (STYLE_DISPLAY_NAMES[key] || '').toLowerCase().split(/\s+/);
    const candidateWords = [...new Set([...keyWords, ...displayWords])];

    const score = inputWords.filter(w =>
      candidateWords.some(cw => cw.includes(w) || w.includes(cw))
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  if (bestScore >= 2 && bestMatch) return bestMatch;

  return null;
}
