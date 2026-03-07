import { notFound } from 'next/navigation';
import { resolvePortal } from '@/lib/portals/resolvePortal';
import { resolveBranding } from '@/lib/portals/resolveBranding';
import { transformDataForSkeleton } from '@/lib/portals/transformData';
import { createClient } from '@/lib/supabase/server';
import { PortalClient } from './PortalClient';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params;

  const resolved = await resolvePortal(token);
  if (!resolved) notFound();

  const { portal, tenant, events } = resolved;

  // Fire-and-forget view count
  const supabase = await createClient();
  void supabase.rpc('increment_view_count', { p_offering_id: portal.id });

  // 3-tier branding cascade: platform defaults → tenant → offering.branding
  const brand = resolveBranding(tenant, portal.branding as Record<string, unknown> | null);

  const data = transformDataForSkeleton(events, portal.skeleton_id, portal.platform_type);

  return (
    <PortalClient
      portal={{
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

  return {
    title: `${resolved.portal.name} — ${resolved.tenant.name}`,
    description: `Real-time analytics portal powered by ${resolved.tenant.name}`,
    robots: 'noindex, nofollow',
    ...(brand.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}),
  };
}
