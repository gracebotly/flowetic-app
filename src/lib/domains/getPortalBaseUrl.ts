/**
 * Returns the base URL for portal/product pages.
 *
 * This is THE central function for URL generation across the entire app.
 * Used in 9+ locations (wizard success, portal detail, access tab,
 * magic link copy, welcome emails, product pages, etc.)
 *
 * Rules (from refactor plan — these must NEVER change):
 * 1. If tenant has a verified custom domain → use it
 * 2. If tenant has NO custom domain, OR domain is unverified → fallback to default
 * 3. The fallback is NEVER empty or broken
 *
 * The fallback to getflowetic.com is a business asset (free advertising).
 */

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.getflowetic.com';

interface TenantDomainInfo {
  custom_domain: string | null;
  domain_verified: boolean;
}

/**
 * Get the base URL for public-facing portal and product pages.
 *
 * @param tenant - Object with custom_domain and domain_verified fields
 * @returns Full base URL with protocol, no trailing slash
 *
 * @example
 * // Verified custom domain
 * getPortalBaseUrl({ custom_domain: 'portal.smith.agency', domain_verified: true })
 * // → 'https://portal.smith.agency'
 *
 * // No domain configured
 * getPortalBaseUrl({ custom_domain: null, domain_verified: false })
 * // → 'https://app.getflowetic.com'
 *
 * // Domain configured but NOT verified (DNS pending)
 * getPortalBaseUrl({ custom_domain: 'portal.smith.agency', domain_verified: false })
 * // → 'https://app.getflowetic.com'  (fallback — domain not ready)
 */
export function getPortalBaseUrl(tenant: TenantDomainInfo): string {
  if (tenant.custom_domain && tenant.domain_verified) {
    return `https://${tenant.custom_domain}`;
  }

  return DEFAULT_BASE_URL;
}

/**
 * Check if a tenant is currently using a verified custom domain.
 * Convenience helper for conditional UI rendering.
 */
export function hasVerifiedDomain(tenant: TenantDomainInfo): boolean {
  return Boolean(tenant.custom_domain && tenant.domain_verified);
}
