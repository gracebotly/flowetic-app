import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { lookupTenantByDomain } from '@/lib/domains/edgeTenantLookup';

/**
 * Root domain for custom domain detection.
 * If not set, custom domain detection is completely skipped (safe default).
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN; // e.g. "getflowetic.com"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.getflowetic.com';

/**
 * Check if a hostname belongs to the root domain (including subdomains).
 * e.g. "app.getflowetic.com" and "getflowetic.com" both match "getflowetic.com"
 */
function isRootDomain(hostname: string): boolean {
  if (!ROOT_DOMAIN) return true; // No root domain set = treat everything as root
  return hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`);
}

/**
 * Check if the hostname is localhost or a local dev domain.
 */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('localhost:') ||
    hostname.startsWith('127.0.0.1:')
  );
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  // ─── Custom Domain Detection ───────────────────────────────────
  // Only runs if NEXT_PUBLIC_ROOT_DOMAIN is set (feature flag).
  // If hostname is root domain or localhost, skip entirely → existing behavior.

  if (ROOT_DOMAIN && !isRootDomain(hostname) && !isLocalhost(hostname)) {
    // This request is on a custom domain (e.g., portal.smithdigital.agency)

    // Control panel on custom domain → redirect to main domain
    if (pathname.startsWith('/control-panel')) {
      return NextResponse.redirect(`${APP_URL}${pathname}${request.nextUrl.search}`);
    }

    // Login/signup on custom domain → redirect to main domain
    if (pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(`${APP_URL}${pathname}${request.nextUrl.search}`);
    }

    // Resolve tenant by domain
    const tenantId = await lookupTenantByDomain(hostname);

    if (!tenantId) {
      // Unknown domain → show domain-not-found page
      const url = request.nextUrl.clone();
      url.pathname = '/domain-not-found';
      return NextResponse.rewrite(url);
    }

    // Known custom domain → inject headers and continue
    // These headers are read by server components and API routes
    const response = NextResponse.next({ request });
    response.headers.set('x-tenant-id', tenantId);
    response.headers.set('x-custom-domain', hostname);
    response.headers.set('x-next-pathname', pathname);

    // Mark the request so the Supabase middleware helper knows
    // to skip auth redirect (custom domain serves only public content)
    request.headers.set('x-custom-domain', hostname);

    return response;
  }

  // ─── Default Behavior (root domain / localhost) ────────────────
  // Exactly the same as before — no changes to existing behavior.

  const response = await updateSession(request);

  // Pass pathname to server components via header for block-guard logic
  response.headers.set('x-next-pathname', pathname);

  return response;
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
