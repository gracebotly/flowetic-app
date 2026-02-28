// ============================================================================
// Level 4: Slug Utilities
// ============================================================================

/**
 * Generate a URL-safe slug from a product name.
 * "Lead Qualifier Pro" → "lead-qualifier-pro"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80); // Max 80 chars for slug
}

/**
 * Ensure slug uniqueness by appending a suffix if needed.
 * Called from API route after checking DB.
 */
export function appendSlugSuffix(slug: string, suffix: number): string {
  return `${slug}-${suffix}`;
}
