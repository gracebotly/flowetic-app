'use client';

import { useState } from 'react';
import { Activity as ActivityIcon, LayoutDashboard } from 'lucide-react';
import { PortalShell, type PortalTab } from '@/components/portals/PortalShell';
import { VoicePerformanceSkeleton } from '@/components/portals/skeletons/VoicePerformanceSkeleton';
import { WorkflowOperationsSkeleton } from '@/components/portals/skeletons/WorkflowOperationsSkeleton';
import { ROISummarySkeleton } from '@/components/portals/skeletons/ROISummarySkeleton';
import { CombinedOverviewSkeleton } from '@/components/portals/skeletons/CombinedOverviewSkeleton';
import { ActivityTab } from '@/components/portals/ActivityTab';
import type { PortalEvent, SkeletonData } from '@/lib/portals/transformData';

interface PortalClientProps {
  portal: {
    name: string;
    skeleton_id: string;
    surface_type: string;
    platform_type: string;
  };
  tenant: {
    name: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
  };
  data: SkeletonData;
  events: PortalEvent[];
}

function getTabs(surfaceType: string): PortalTab[] {
  switch (surfaceType) {
    case 'runner':
      return [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }];
    case 'both':
    case 'analytics':
    default:
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'activity', label: 'Activity', icon: ActivityIcon },
      ];
  }
}

export function PortalClient({ portal, tenant, data, events }: PortalClientProps) {
  const tabs = getTabs(portal.surface_type);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'dashboard');

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
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'dashboard' && (
        <>
          {portal.skeleton_id === 'voice-performance' && <VoicePerformanceSkeleton data={data} branding={branding} />}
          {portal.skeleton_id === 'workflow-operations' && <WorkflowOperationsSkeleton data={data} branding={branding} />}
          {portal.skeleton_id === 'roi-summary' && <ROISummarySkeleton data={data} branding={branding} />}
          {portal.skeleton_id === 'combined-overview' && <CombinedOverviewSkeleton data={data} branding={branding} />}
        </>
      )}
      {activeTab === 'activity' && (
        <ActivityTab
          events={events}
          platformType={portal.platform_type}
          branding={{ primary_color: tenant.primary_color, portalName: portal.name }}
        />
      )}
    </PortalShell>
  );
}
