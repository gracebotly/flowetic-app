/**
 * Validation for custom_path on client_portals.
 *
 * custom_path is the agency-controlled clean URL segment used on custom domains.
 * e.g., "invoice-tracker" → portal.smith.agency/invoice-tracker
 *
 * Rules:
 * - Lowercase alphanumeric + hyphens only
 * - 3–60 characters
 * - Cannot start or end with a hyphen
 * - Cannot collide with reserved app routes
 * - Unique per tenant (enforced by DB index, but pre-checked here for friendly errors)
 */

/**
 * Reserved paths that conflict with existing app routes.
 * These cannot be used as a custom_path value.
 *
 * Derived from: src/app/ directory structure + middleware special paths.
 */
const RESERVED_PATHS = new Set([
  'hub',             // /client/hub/[hubToken] → /hub/[hubToken] on custom domains
  'api',             // /api/* — API routes
  'control-panel',   // redirected to main domain by middleware
  'login',           // redirected to main domain by middleware
  'signup',          // redirected to main domain by middleware
  'auth',            // /auth/* — auth callbacks
  'invite',          // /invite/[token]
  'domain-not-found',// error page
  'portal-preview',  // preview route
  'products',        // legacy /products/[slug] route
  'client',          // existing /client/[token] route
  'p',               // existing /p/[slug] route
  '_next',           // Next.js internals
  'favicon.ico',     // static file
]);

const PATH_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 60;

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  /** Cleaned/normalized path (lowercase, trimmed) */
  cleaned?: string;
}

export function validateCustomPath(path: string): PathValidationResult {
  // Normalize
  const cleaned = path.trim().toLowerCase();

  if (!cleaned) {
    return { valid: false, error: 'Path cannot be empty' };
  }

  if (cleaned.length < MIN_LENGTH) {
    return { valid: false, error: `Path must be at least ${MIN_LENGTH} characters` };
  }

  if (cleaned.length > MAX_LENGTH) {
    return { valid: false, error: `Path cannot exceed ${MAX_LENGTH} characters` };
  }

  // Check format: lowercase alphanumeric + hyphens, no leading/trailing hyphens
  // Special case: single valid characters (length already checked above to be >= 3)
  if (!PATH_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'Path can only contain lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.',
    };
  }

  // No consecutive hyphens
  if (cleaned.includes('--')) {
    return { valid: false, error: 'Path cannot contain consecutive hyphens' };
  }

  // Reserved path check
  if (RESERVED_PATHS.has(cleaned)) {
    return {
      valid: false,
      error: `"${cleaned}" is a reserved path and cannot be used`,
    };
  }

  return { valid: true, cleaned };
}

/**
 * Generate a custom_path from a portal name.
 * Same logic as generateCleanSlug in the create route.
 */
export function generateCustomPath(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, MAX_LENGTH);
}
