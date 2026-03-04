"use client";

import { useEffect, useState, useMemo, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";

import { PortalShell } from "@/components/portals/PortalShell";
import { VoicePerformanceSkeleton } from "@/components/portals/skeletons/VoicePerformanceSkeleton";
import { WorkflowOperationsSkeleton } from "@/components/portals/skeletons/WorkflowOperationsSkeleton";
import { ROISummarySkeleton } from "@/components/portals/skeletons/ROISummarySkeleton";
import { CombinedOverviewSkeleton } from "@/components/portals/skeletons/CombinedOverviewSkeleton";
import { getSkeletonForPlatform } from "@/lib/portals/platformToSkeleton";
import { transformDataForSkeleton } from "@/lib/portals/transformData";
import type { SkeletonData } from "@/lib/portals/transformData";
import { getVoiceFieldMapping, getWorkflowFieldMapping } from "@/lib/portals/fieldMappings";
import { FormWizard } from "@/components/products/FormWizard";

type PreviewEvent = Record<string, unknown>;
type SkeletonProps = {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
};
type Branding = {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  welcome_message: string | null;
  brand_footer: string | null;
  tenant_name: string | null;
};

const SKELETON_COMPONENTS: Record<string, ComponentType<SkeletonProps>> = {
  "voice-performance": VoicePerformanceSkeleton,
  "workflow-operations": WorkflowOperationsSkeleton,
  "roi-summary": ROISummarySkeleton,
  "combined-overview": CombinedOverviewSkeleton,
};

function generateSampleVoiceData(): PreviewEvent[] {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    id: `sample-${i}`,
    type: "call.completed",
    name: "call.completed",
    value: Math.random() > 0.15 ? 1 : 0,
    unit: "count",
    text: `Sample call ${i + 1}`,
    state: Math.random() > 0.15 ? "completed" : "failed",
    labels: { duration_seconds: Math.floor(45 + Math.random() * 300) },
    timestamp: new Date(now - i * 3600000).toISOString(),
  }));
}

function generateSampleWorkflowData(): PreviewEvent[] {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    id: `sample-${i}`,
    type: "execution.completed",
    name: "execution.completed",
    value: Math.random() > 0.08 ? 1 : 0,
    unit: "count",
    text: `Execution ${i + 1}`,
    state: Math.random() > 0.08 ? "success" : "error",
    labels: { duration_ms: Math.floor(800 + Math.random() * 4000) },
    timestamp: new Date(now - i * 1800000).toISOString(),
  }));
}

export default function PreviewPage() {
  const params = useSearchParams();
  const sourceId = params.get("source_id");
  const platform = params.get("platform") || "vapi";
  const surface = params.get("surface") || "analytics";

  const [branding, setBranding] = useState<Branding | null>(null);
  const [events, setEvents] = useState<PreviewEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  const skeletonId = useMemo(() => getSkeletonForPlatform(platform), [platform]);
  const SkeletonComponent = SKELETON_COMPONENTS[skeletonId];

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [brandRes, eventsRes] = await Promise.all([
          fetch("/api/settings/branding"),
          sourceId ? fetch(`/api/events?source_id=${sourceId}&limit=50`) : Promise.resolve(null),
        ]);
        const brandData: Branding | null = brandRes.ok ? await brandRes.json() : null;
        const eventsData: unknown = eventsRes && eventsRes.ok ? await eventsRes.json() : null;

        if (!mounted) return;
        setBranding(brandData);

        const maybeObject = (eventsData && typeof eventsData === "object") ? (eventsData as { events?: unknown; data?: unknown }) : null;
        const real = maybeObject?.events ?? maybeObject?.data ?? eventsData;

        if (Array.isArray(real) && real.length > 0) {
          setEvents(real as PreviewEvent[]);
        } else {
          const isVoice = platform === "vapi" || platform === "retell";
          setEvents(isVoice ? generateSampleVoiceData() : generateSampleWorkflowData());
        }
      } catch {
        const isVoice = platform === "vapi" || platform === "retell";
        setEvents(isVoice ? generateSampleVoiceData() : generateSampleWorkflowData());
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [sourceId, platform]);

  const transformedData = useMemo(() => {
    if (!events || !skeletonId) return null;
    try {
      const mappings =
        platform === "vapi" || platform === "retell"
          ? getVoiceFieldMapping(platform)
          : getWorkflowFieldMapping(platform);
      return transformDataForSkeleton(events, skeletonId, mappings);
    } catch {
      return null;
    }
  }, [events, skeletonId, platform]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const showAnalytics = surface === "analytics" || surface === "both";
  const showProduct = surface === "runner" || surface === "both";

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white">
        <Eye className="h-3.5 w-3.5" />
        Preview Mode — This is how your client will see it
      </div>

      {showAnalytics && (
        <PortalShell
          branding={{
            logo_url: branding?.logo_url || null,
            primary_color: branding?.primary_color || "#3b82f6",
            secondary_color: branding?.secondary_color || "#1e40af",
            welcome_message: branding?.welcome_message || "Welcome to your dashboard",
            brand_footer: branding?.brand_footer || branding?.tenant_name || "",
          }}
        >
          {SkeletonComponent && transformedData ? (
            <SkeletonComponent
              data={transformedData}
              branding={{
                primary_color: branding?.primary_color || "#3b82f6",
                secondary_color: branding?.secondary_color || "#1e40af",
                logo_url: branding?.logo_url || null,
                portalName: branding?.tenant_name || "Dashboard",
              }}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500">Unable to load preview.</div>
          )}
        </PortalShell>
      )}

      {showProduct && (
        <div className="mx-auto max-w-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900">Product Form Preview</h1>
          <p className="mb-8 mt-2 text-sm text-gray-600">This is the form your customers will fill out.</p>
          <FormWizard
            fields={[
              {
                name: "phone_number",
                type: "phone",
                label: "Phone Number",
                required: true,
                placeholder: "+1 (555) 123-4567",
              },
              {
                name: "customer_name",
                type: "text",
                label: "Name",
                required: true,
                placeholder: "Full name",
              },
            ]}
            onSubmit={() => {}}
            isPreview={true}
          />
        </div>
      )}
    </div>
  );
}
