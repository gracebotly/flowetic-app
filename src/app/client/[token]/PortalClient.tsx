'use client';

import { useEffect, useState } from 'react';
import { Activity as ActivityIcon, LayoutDashboard } from 'lucide-react';
import { PortalShell, type PortalTab } from '@/components/portals/PortalShell';
import { PortalSessionSetter } from '@/components/portals/PortalSessionSetter';
import { trackClientPortalViewed } from '@/lib/analytics/events';
import { VoicePerformanceSkeleton } from '@/components/portals/skeletons/VoicePerformanceSkeleton';
import { WorkflowOperationsSkeleton } from '@/components/portals/skeletons/WorkflowOperationsSkeleton';
import { ROISummarySkeleton } from '@/components/portals/skeletons/ROISummarySkeleton';
import { MultiAgentVoiceSkeleton } from '@/components/portals/skeletons/MultiAgentVoiceSkeleton';
import { ActivityTab } from '@/components/portals/ActivityTab';
import type { PortalEvent, SkeletonData } from '@/lib/portals/transformData';

interface PortalClientProps {
  portal: {
    id: string;
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
  brand: {
    footerText: string;
    faviconUrl: string | null;
    defaultTheme: 'light' | 'dark';
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

export function PortalClient({ portal, tenant, brand, data, events }: PortalClientProps) {
  const tabs = getTabs(portal.surface_type);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'dashboard');

  useEffect(() => {
    trackClientPortalViewed(portal.id, portal.platform_type || "unknown");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      defaultTheme={brand.defaultTheme}
      footerText={brand.footerText}
      faviconUrl={brand.faviconUrl}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <PortalSessionSetter portalId={portal.id} />
      {activeTab === 'dashboard' && (
        <>
          {portal.skeleton_id === 'voice-performance' && <VoicePerformanceSkeleton data={data} branding={branding} />}
          {portal.skeleton_id === 'multi-agent-voice' && <MultiAgentVoiceSkeleton data={data} branding={branding} />}
          {portal.skeleton_id === 'workflow-operations' && <WorkflowOperationsSkeleton data={data} branding={branding} />}
          {portal.skeleton_id === 'roi-summary' && <ROISummarySkeleton data={data} branding={branding} />}
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
