import { notFound } from 'next/navigation';
import { resolvePortal } from '@/lib/portals/resolvePortal';
import { transformDataForSkeleton } from '@/lib/portals/transformData';
import { createClient } from '@/lib/supabase/server';
import { PortalClient } from './PortalClient';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params;

  const resolved = await resolvePortal(token);
  if (!resolved) notFound();

  const { portal, tenant, events } = resolved;

  const supabase = await createClient();
  void supabase.rpc('increment_view_count', { p_offering_id: portal.id });

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
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
      }}
      data={data}
      events={events}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const resolved = await resolvePortal(token);

  if (!resolved) {
    return { title: 'Portal Not Found' };
  }

  return {
    title: `${resolved.portal.name} — ${resolved.tenant.name}`,
    description: `Real-time analytics portal powered by ${resolved.tenant.name}`,
    robots: 'noindex, nofollow',
  };
}
