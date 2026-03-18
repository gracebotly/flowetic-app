/**
 * 3-Tier Branding Cascade
 *
 * Tier 1: Getflowetic platform defaults
 * Tier 2: Agency branding (from tenants table)
 * Tier 3: Per-portal override (from offerings.branding JSONB)
 *
 * Each tier overrides the previous. Only non-null/non-empty values override.
 */

export interface ResolvedBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  faviconUrl: string | null;
  defaultTheme: 'light' | 'dark';
  welcomeMessage: string;
}

// Tier 1: Platform defaults (used when tenant has no branding set)
const PLATFORM_DEFAULTS: ResolvedBranding = {
  logoUrl: null,
  primaryColor: '#059669',
  secondaryColor: '#065F46',
  footerText: 'Powered by Getflowetic',
  faviconUrl: null,
  defaultTheme: 'dark',
  welcomeMessage: 'Welcome to your dashboard',
};

interface TenantBranding {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  brand_footer?: string | null;
  favicon_url?: string | null;
  default_theme?: string | null;
  welcome_message?: string | null;
}

interface PortalBrandingOverride {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  footer_text?: string | null;
  favicon_url?: string | null;
  default_theme?: string | null;
}

/**
 * Resolve branding through 3-tier cascade.
 * Only non-null, non-empty string values override the previous tier.
 */
export function resolveBranding(
  tenant: TenantBranding,
  portalOverride?: Record<string, unknown> | null
): ResolvedBranding {
  // Start with platform defaults
  const result: ResolvedBranding = { ...PLATFORM_DEFAULTS };

  // Tier 2: Agency overrides
  if (isNonEmpty(tenant.logo_url)) result.logoUrl = tenant.logo_url!;
  if (isNonEmpty(tenant.primary_color)) result.primaryColor = tenant.primary_color!;
  if (isNonEmpty(tenant.secondary_color)) result.secondaryColor = tenant.secondary_color!;
  if (isNonEmpty(tenant.brand_footer)) result.footerText = tenant.brand_footer!;
  if (isNonEmpty(tenant.favicon_url)) result.faviconUrl = tenant.favicon_url!;
  if (tenant.default_theme === 'light' || tenant.default_theme === 'dark') {
    result.defaultTheme = tenant.default_theme;
  }
  if (isNonEmpty(tenant.welcome_message)) result.welcomeMessage = tenant.welcome_message!;

  // Tier 3: Per-portal overrides (from offerings.branding JSONB)
  if (portalOverride && typeof portalOverride === 'object') {
    const o = portalOverride as PortalBrandingOverride;
    if (isNonEmpty(o.logo_url)) result.logoUrl = o.logo_url!;
    if (isNonEmpty(o.primary_color)) result.primaryColor = o.primary_color!;
    if (isNonEmpty(o.secondary_color)) result.secondaryColor = o.secondary_color!;
    if (isNonEmpty(o.footer_text)) result.footerText = o.footer_text!;
    if (isNonEmpty(o.favicon_url)) result.faviconUrl = o.favicon_url!;
    if (o.default_theme === 'light' || o.default_theme === 'dark') {
      result.defaultTheme = o.default_theme;
    }
  }

  return result;
}

function isNonEmpty(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}
