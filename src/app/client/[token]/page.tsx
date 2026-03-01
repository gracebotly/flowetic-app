import { notFound } from 'next/navigation';
import { resolvePortal } from '@/lib/portals/resolvePortal';
import { transformDataForSkeleton } from '@/lib/portals/transformData';
import { PortalShell } from '@/components/portals/PortalShell';
import { VoicePerformanceSkeleton } from '@/components/portals/skeletons/VoicePerformanceSkeleton';
import { WorkflowOperationsSkeleton } from '@/components/portals/skeletons/WorkflowOperationsSkeleton';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params;

  const resolved = await resolvePortal(token);
  if (!resolved) notFound();

  const { portal, tenant, events } = resolved;

  const data = transformDataForSkeleton(events, portal.skeleton_id, portal.platform_type);

  const branding = {
    primary_color: tenant.primary_color,
    secondary_color: tenant.secondary_color,
    logo_url: tenant.logo_url,
    portalName: portal.name,
  };

  return (
    <PortalShell
      portalName={portal.name}
      tenantName={tenant.name}
      logoUrl={tenant.logo_url}
      primaryColor={tenant.primary_color}
      secondaryColor={tenant.secondary_color}
    >
      {(portal.skeleton_id === 'voice-performance') && (
        <VoicePerformanceSkeleton data={data} branding={branding} />
      )}
      {(portal.skeleton_id === 'workflow-operations') && (
        <WorkflowOperationsSkeleton data={data} branding={branding} />
      )}
    </PortalShell>
  );
}

// ── Metadata ─────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const resolved = await resolvePortal(token);
  
  if (!resolved) {
    return { title: 'Portal Not Found' };
  }

  return {
    title: `${resolved.portal.name} — ${resolved.tenant.name}`,
    description: `Real-time analytics portal powered by ${resolved.tenant.name}`,
    robots: 'noindex, nofollow', // Client portals should not be indexed
  };
}
