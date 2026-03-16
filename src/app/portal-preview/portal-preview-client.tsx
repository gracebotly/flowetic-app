"use client";

import { useEffect, useState, useMemo, type ComponentType } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";

import { PortalShell } from "@/components/portals/PortalShell";
import { VoicePerformanceSkeleton } from "@/components/portals/skeletons/VoicePerformanceSkeleton";
import { WorkflowOperationsSkeleton } from "@/components/portals/skeletons/WorkflowOperationsSkeleton";
import { ROISummarySkeleton } from "@/components/portals/skeletons/ROISummarySkeleton";
import { MultiAgentVoiceSkeleton } from "@/components/portals/skeletons/MultiAgentVoiceSkeleton";
import { getSkeletonForPlatformMix } from "@/lib/portals/platformToSkeleton";
import { transformDataForSkeleton, type SkeletonData, type PortalEvent } from "@/lib/portals/transformData";

type PreviewEvent = PortalEvent;
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
  name: string | null;
};

const SKELETON_COMPONENTS: Record<string, ComponentType<SkeletonProps>> = {
  "voice-performance": VoicePerformanceSkeleton,
  "workflow-operations": WorkflowOperationsSkeleton,
  "roi-summary": ROISummarySkeleton,
  "multi-agent-voice": MultiAgentVoiceSkeleton,
};

export default function PortalPreviewClient() {
  const params = useSearchParams();
  const router = useRouter();

  // Auth guard — only agency users can see preview
  useEffect(() => {
    fetch("/api/settings/branding").then((res) => {
      if (res.status === 401) {
        router.replace("/login");
      }
    }).catch(() => {});
  }, [router]);

  const sourceId = params.get("source_id");
  const platform = params.get("platform") || "vapi";
  const surface = params.get("surface") || "analytics";
  const entityExternalIds = params.get("entity_external_ids"); // comma-separated external_ids
  const entityCount = Number(params.get("entity_count") ?? "1") || 1;

  const [branding, setBranding] = useState<Branding | null>(null);
  const [events, setEvents] = useState<PreviewEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  const skeletonId = useMemo(
    () => getSkeletonForPlatformMix([platform], entityCount),
    [platform, entityCount]
  );
  const SkeletonComponent = SKELETON_COMPONENTS[skeletonId];

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [brandRes, eventsRes] = await Promise.all([
          fetch("/api/settings/branding"),
          sourceId
            ? fetch(`/api/events?source_id=${sourceId}&limit=500${entityExternalIds ? `&entity_external_ids=${encodeURIComponent(entityExternalIds)}` : ""}`)
            : Promise.resolve(null),
        ]);
        let brandData: Branding | null = null;
        if (brandRes.ok) {
          const json = await brandRes.json();
          if (json.ok && json.branding) {
            brandData = json.branding as Branding;
          }
        }
        const eventsData: unknown = eventsRes && eventsRes.ok ? await eventsRes.json() : null;

        if (!mounted) return;
        setBranding(brandData);

        const maybeObject = (eventsData && typeof eventsData === "object") ? (eventsData as { events?: unknown; data?: unknown }) : null;
        const real = maybeObject?.events ?? maybeObject?.data ?? eventsData;

        if (Array.isArray(real) && real.length > 0) {
          setEvents(real as PreviewEvent[]);
        } else {
          setEvents([]);
        }
      } catch {
        setEvents([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [sourceId, platform, entityExternalIds]);

  const transformedData = useMemo(() => {
    if (!events || !skeletonId) return null;
    try {
      return transformDataForSkeleton(events, skeletonId, platform);
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
          portalName={params.get("entity_name") || "Your Portal"}
          tenantName={branding?.name || "Getflowetic"}
          logoUrl={branding?.logo_url || null}
          primaryColor={branding?.primary_color || "#3b82f6"}
          secondaryColor={branding?.secondary_color || "#1e40af"}
        >
          {SkeletonComponent && transformedData ? (
            <SkeletonComponent
              data={transformedData}
              branding={{
                primary_color: branding?.primary_color || "#3b82f6",
                secondary_color: branding?.secondary_color || "#1e40af",
                logo_url: branding?.logo_url || null,
                portalName: branding?.name || "Dashboard",
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
          <div className="space-y-4">
            {[
              { label: "Phone Number", type: "PHONE", required: true },
              { label: "Customer Name", type: "TEXT", required: true },
            ].map((field) => (
              <div key={field.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{field.label}</span>
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">{field.type}</span>
                  </div>
                  {field.required && (
                    <span className="text-[10px] font-medium text-red-400">Required</span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400">Your customers will fill out a step-by-step form.</p>
          </div>
        </div>
      )}
    </div>
  );
}
