import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { resolvePortal } from '@/lib/portals/resolvePortal';
import { resolveBranding } from '@/lib/portals/resolveBranding';
import { transformDataForSkeleton } from '@/lib/portals/transformData';
import { createClient } from '@/lib/supabase/server';
import { PortalClient } from './PortalClient';
import type { Metadata } from 'next';
import { getPortalBaseUrl } from '@/lib/domains/getPortalBaseUrl';
import { createClient as createServiceClient } from '@supabase/supabase-js';

interface PageProps {
  params: Promise<{ token: string }>;
}

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params;

  const resolved = await resolvePortal(token);
  if (!resolved) notFound();

  const { portal, tenant, events } = resolved;

  // ── Payment gate enforcement ──────────────────────────────
  // If this portal requires payment, verify the visitor has a valid session.
  // The session cookie is set by POST /api/portal-session after successful
  // Stripe checkout. Without it, redirect to the subscribe page.
  const isPaid =
    portal.access_type === 'stripe_gate' &&
    (portal as Record<string, unknown>).pricing_type !== 'free';

  if (isPaid) {
    const portalSlug = (portal as Record<string, unknown>).slug as string | null;

    // If no slug exists, this is a misconfigured paid portal — can't redirect
    if (!portalSlug) {
      console.error(
        '[client/[token]] Paid portal missing slug — cannot redirect to subscribe:',
        portal.id
      );
      notFound();
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(`portal_session_${portal.id}`);
    const emailCookie = cookieStore.get(`portal_email_${portal.id}`);

    let hasValidSubscription = false;

    if (sessionCookie?.value && emailCookie?.value) {
      // Verify the email actually has an active subscription
      const { data: customer } = await supabaseAdmin
        .from('portal_customers')
        .select('subscription_status')
        .eq('portal_id', portal.id)
        .eq('email', emailCookie.value)
        .maybeSingle();

      if (customer?.subscription_status === 'active') {
        hasValidSubscription = true;
      }
    }

    if (!hasValidSubscription) {
      redirect(`/p/${portalSlug}/subscribe`);
    }
  }

  // ── Render dashboard (free portals, or paid with valid session) ──
  // Fire-and-forget view count
  const supabase = await createClient();
  void supabase.rpc('increment_view_count', { p_offering_id: portal.id });

  // 3-tier branding cascade: platform defaults → tenant → offering.branding
  const brand = resolveBranding(tenant, portal.branding as Record<string, unknown> | null);

  const data = transformDataForSkeleton(events, portal.skeleton_id, portal.platform_type);

  return (
    <PortalClient
      portal={{
        id: portal.id,
        name: portal.name,
        skeleton_id: portal.skeleton_id,
        surface_type: portal.surface_type,
        platform_type: portal.platform_type,
      }}
      tenant={{
        name: tenant.name,
        logo_url: brand.logoUrl,
        primary_color: brand.primaryColor,
        secondary_color: brand.secondaryColor,
      }}
      brand={{
        footerText: brand.footerText,
        faviconUrl: brand.faviconUrl,
        defaultTheme: brand.defaultTheme,
      }}
      data={data}
      events={events}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const resolved = await resolvePortal(token);

  if (!resolved) {
    return { title: 'Portal Not Found' };
  }

  const brand = resolveBranding(resolved.tenant, resolved.portal.branding as Record<string, unknown> | null);

  // Canonical URL: use custom domain when verified, otherwise default domain
  const baseUrl = getPortalBaseUrl({
    custom_domain: resolved.tenant.custom_domain,
    domain_verified: resolved.tenant.domain_verified,
  });
  const canonicalUrl = `${baseUrl}/client/${token}`;

  return {
    title: `${resolved.portal.name} — ${resolved.tenant.name}`,
    description: `Real-time analytics portal powered by ${resolved.tenant.name}`,
    robots: 'noindex, nofollow',
    alternates: {
      canonical: canonicalUrl,
    },
    ...(brand.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}),
  };
}
