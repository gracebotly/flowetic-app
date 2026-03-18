"use client";

import { useState, useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import {
  Tablet,
  Smartphone,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@tremor/react";
import { motion } from "framer-motion";

import { PortalShell } from "@/components/portals/PortalShell";
import { VoicePerformanceSkeleton } from "@/components/portals/skeletons/VoicePerformanceSkeleton";
import { WorkflowOperationsSkeleton } from "@/components/portals/skeletons/WorkflowOperationsSkeleton";
import { ROISummarySkeleton } from "@/components/portals/skeletons/ROISummarySkeleton";
import { MultiAgentVoiceSkeleton } from "@/components/portals/skeletons/MultiAgentVoiceSkeleton";
import { getSkeletonForPlatform, getSkeletonForPlatformMix } from "@/lib/portals/platformToSkeleton";
import { transformDataForSkeleton, type SkeletonData, type PortalEvent } from "@/lib/portals/transformData";


type DeviceMode = "tablet" | "mobile";

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

interface PortalPreviewProps {
  platformType: string;
  sourceId: string;
  entityName: string;
  surfaceType: string;
  entityExternalIds?: string; // comma-separated external_ids for filtering
  entityCount?: number;
  customTitle?: string;
}

interface Branding {
  name?: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  welcome_message: string | null;
  brand_footer: string | null;
}

const DEVICES: Record<DeviceMode, { width: number; label: string; icon: typeof Tablet }> = {
  tablet: { width: 768, label: "Tablet", icon: Tablet },
  mobile: { width: 375, label: "Mobile", icon: Smartphone },
};

const SKELETON_COMPONENTS: Record<string, ComponentType<SkeletonProps>> = {
  "voice-performance": VoicePerformanceSkeleton,
  "workflow-operations": WorkflowOperationsSkeleton,
  "roi-summary": ROISummarySkeleton,
  "multi-agent-voice": MultiAgentVoiceSkeleton,
};

function BrowserChrome({
  mode,
  children,
}: {
  mode: DeviceMode;
  children: ReactNode;
}) {
  if (mode === "tablet") {
    return (
      <div className="overflow-hidden rounded-2xl border-[3px] border-slate-700 shadow-2xl dark:border-slate-500">
        {/* Top bezel — camera dot */}
        <div className="flex items-center justify-center bg-slate-700 py-2 dark:bg-slate-500">
          <div className="h-2 w-2 rounded-full bg-slate-500 dark:bg-slate-400" />
        </div>
        {/* Screen area — clips X overflow but allows Y scroll */}
        <div className="overflow-x-hidden overflow-y-hidden">{children}</div>
        {/* Bottom bezel — home bar */}
        <div className="flex justify-center bg-slate-700 py-2.5 dark:bg-slate-500">
          <div className="h-1 w-10 rounded-full bg-slate-500 dark:bg-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border-[4px] border-slate-800 shadow-2xl dark:border-slate-500">
      <div className="flex justify-center bg-slate-800 pb-1 pt-2 dark:bg-slate-500">
        <div className="h-5 w-24 rounded-full bg-slate-900 dark:bg-slate-600" />
      </div>
      <div className="bg-white dark:bg-slate-950">{children}</div>
      <div className="flex justify-center bg-slate-800 py-2 dark:bg-slate-500">
        <div className="h-1 w-28 rounded-full bg-slate-600 dark:bg-slate-400" />
      </div>
    </div>
  );
}

export default function PortalPreview({
  platformType,
  sourceId,
  entityName,
  surfaceType,
  entityExternalIds,
  entityCount,
  customTitle,
}: PortalPreviewProps) {
  const [device, setDevice] = useState<DeviceMode>("tablet");
  const [branding, setBranding] = useState<Branding | null>(null);
  const [events, setEvents] = useState<PreviewEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  const skeletonId = useMemo(() => {
    // If multiple entities are selected (passed via prop), use mix detection
    if (typeof entityCount === 'number' && entityCount > 1) {
      return getSkeletonForPlatformMix([platformType], entityCount);
    }
    return getSkeletonForPlatform(platformType);
  }, [platformType, entityCount]);
  const SkeletonComponent = SKELETON_COMPONENTS[skeletonId];

  useEffect(() => {
    let mounted = true;

    async function fetchPreviewData() {
      setLoading(true);
      try {
        const brandingRes = await fetch("/api/settings/branding");
        let brandingData: Branding | null = null;
        if (brandingRes.ok) {
          const json = await brandingRes.json();
          if (json.ok && json.branding) {
            brandingData = json.branding as Branding;
          }
        }

        const eventsRes = await fetch(`/api/events?source_id=${sourceId}&limit=100${entityExternalIds ? `&entity_external_ids=${encodeURIComponent(entityExternalIds)}` : ""}`);
        const eventsData: unknown = eventsRes.ok ? await eventsRes.json() : null;

        if (!mounted) return;

        setBranding(brandingData);

        const maybeObject = (eventsData && typeof eventsData === "object") ? (eventsData as { events?: unknown; data?: unknown }) : null;
        const realEvents = maybeObject?.events ?? maybeObject?.data ?? eventsData;
        const finalEvents: PreviewEvent[] = Array.isArray(realEvents) ? realEvents as PreviewEvent[] : [];

        // ── Aggregate synthesis for entities with zero events ──────
        // Webhook/instant Make scenarios have no individual execution logs.
        // When an entity has zero events but has aggregate_stats, synthesize
        // a summary event so the preview renders KPIs. This mirrors the
        // exact same logic in resolvePortal.ts (step 4b-synth).
        if (entityExternalIds) {
          const selectedIds = entityExternalIds.split(",").map((s) => s.trim()).filter(Boolean);
          const idsWithEvents = new Set<string>();
          for (const ev of finalEvents) {
            const state = (ev.state as Record<string, unknown>) ?? {};
            const wfId = String(state.workflow_id ?? "");
            if (wfId) idsWithEvents.add(wfId);
          }

          const idsMissing = selectedIds.filter((id) => !idsWithEvents.has(id));

          if (idsMissing.length > 0) {
            try {
              const statsRes = await fetch(`/api/indexed-entities/aggregate-stats?external_ids=${encodeURIComponent(idsMissing.join(","))}&source_id=${sourceId}`);
              if (statsRes.ok) {
                const statsJson = await statsRes.json();
                const entitiesWithStats: Array<{ external_id: string; display_name: string; aggregate_stats: Record<string, unknown> | null }> = statsJson.entities ?? [];

                for (const ent of entitiesWithStats) {
                  const stats = ent.aggregate_stats;
                  if (!stats) continue;
                  const totalExecs = Number(stats.total_executions ?? stats.total_operations ?? 0);
                  if (totalExecs <= 0) continue;
                  const totalErrors = Number(stats.total_errors ?? 0);
                  const totalOps = Number(stats.total_operations ?? 0);
                  const totalCenticredits = Number(stats.total_centicredits ?? 0);
                  const totalTransfer = Number(stats.data_transfer_bytes ?? 0);

                  finalEvents.push({
                    id: `synth-preview-${ent.external_id}`,
                    type: "scenario_execution_summary",
                    name: `make:${ent.display_name}:aggregate`,
                    value: totalExecs - totalErrors,
                    state: {
                      workflow_id: ent.external_id,
                      workflow_name: ent.display_name,
                      status: "success",
                      platform: "make",
                      is_aggregate: true,
                      aggregate_total: totalExecs,
                      aggregate_errors: totalErrors,
                      aggregate_success: totalExecs - totalErrors,
                      operations_used: totalOps,
                      centicredits: totalCenticredits,
                      data_transfer_bytes: totalTransfer,
                      duration_ms: 0,
                    },
                    labels: {
                      scenario_id: ent.external_id,
                      platformType: "make",
                      workflow_id: ent.external_id,
                    },
                    timestamp: (stats.updated_at as string) ?? new Date().toISOString(),
                    platform_event_id: null,
                  } as PreviewEvent);
                }
              }
            } catch {
              // Non-fatal — preview just won't show aggregate data
            }
          }
        }

        setEvents(finalEvents);
      } catch {
        setEvents([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPreviewData();
    return () => {
      mounted = false;
    };
  }, [sourceId, platformType, entityExternalIds]);

  const transformedData = useMemo(() => {
    if (!events || !skeletonId) return null;
    try {
      return transformDataForSkeleton(events, skeletonId, platformType);
    } catch {
      return null;
    }
  }, [events, skeletonId, platformType]);

  const dataHealth = transformedData?.health?.status ?? "no-data";
  const isNoData = dataHealth === "no-data";

  const containerMaxWidth = 900;
  const deviceWidth = DEVICES[device].width;
  // Both tablet and mobile benefit from slight scaling to fit the wizard container.
  // Mobile (375px): scale to ~92% so content doesn't feel cramped in the phone chrome.
  const WIZARD_USABLE_WIDTH = 700;
  const scale = deviceWidth > WIZARD_USABLE_WIDTH
    ? WIZARD_USABLE_WIDTH / deviceWidth
    : device === "mobile"
      ? 0.92
      : 1;

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-tremor-brand" />
        <p className="text-sm text-tremor-content dark:text-dark-tremor-content">
          Loading your portal preview...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Preview
          </h2>
          <p className="mt-1 text-sm text-tremor-content dark:text-dark-tremor-content">
            This is exactly what your client will see. Toggle devices to check responsiveness.
          </p>
        </div>

        <a
          href={`/portal-preview?source_id=${sourceId}&platform=${platformType}&surface=${surfaceType}&entity_name=${encodeURIComponent(entityName)}&entity_count=${entityCount ?? 1}${entityExternalIds ? `&entity_external_ids=${encodeURIComponent(entityExternalIds)}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer flex items-center gap-1.5 rounded-tremor-default border border-tremor-border px-3 py-1.5 text-xs font-medium text-tremor-content-strong transition-colors duration-200 hover:bg-tremor-background-subtle dark:border-dark-tremor-border dark:text-dark-tremor-content-strong dark:hover:bg-dark-tremor-background-subtle"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full preview
        </a>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-tremor-background-subtle p-1 dark:bg-dark-tremor-background-subtle">
          {(Object.keys(DEVICES) as DeviceMode[]).map((mode) => {
            const Icon = DEVICES[mode].icon;
            const isActive = device === mode;
            return (
              <button
                key={mode}
                onClick={() => setDevice(mode)}
                className={`cursor-pointer flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-white text-tremor-content-strong shadow-sm dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong"
                    : "text-tremor-content hover:text-tremor-content-strong dark:text-dark-tremor-content dark:hover:text-dark-tremor-content-strong"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {DEVICES[mode].label}
                <span className="opacity-50">{DEVICES[mode].width}px</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {isNoData && (
            <Badge size="xs" color="orange">
              No data
            </Badge>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            width: Math.min(deviceWidth * scale, containerMaxWidth),
            overflow: "visible", // let the device shadow render fully
          }}
        >
          <BrowserChrome mode={device}>
            <div
              style={{
                width: deviceWidth,
                zoom: scale,
                overflowX: "hidden",
                // Height shown in the device frame before scrolling starts
                // Tablet: show ~700px of content (accounts for zoom scale)
                // Mobile: show full phone height
                height: device === "tablet" ? Math.round(680 / scale) : Math.round(720 / scale),
                overflowY: "auto",
                // Prevent scroll from leaking to the outer page
                overscrollBehavior: "contain",
              }}
            >
              <PortalShell
                  portalName={customTitle?.trim() || entityName || "Your Portal"}
                  tenantName={branding?.name || "Getflowetic"}
                  logoUrl={branding?.logo_url || null}
                  primaryColor={branding?.primary_color || "#3b82f6"}
                  secondaryColor={branding?.secondary_color || "#1e40af"}
                  footerText={branding?.brand_footer || ""}
                >
                  {SkeletonComponent && transformedData ? (
                    <SkeletonComponent
                      data={transformedData}
                      branding={{
                        primary_color: branding?.primary_color || "#3b82f6",
                        secondary_color: branding?.secondary_color || "#1e40af",
                        logo_url: branding?.logo_url || null,
                        portalName: branding?.name || entityName,
                      }}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-gray-500">
                      Unable to render preview for this platform.
                    </div>
                  )}
                </PortalShell>
            </div>
          </BrowserChrome>
        </motion.div>
      </div>

      {isNoData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
              No events recorded yet
            </p>
            <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">
              This agent or workflow has no activity in the last 30 days. Your client will see an empty dashboard until data starts flowing. You can still share this portal — it will populate automatically once activity begins.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
