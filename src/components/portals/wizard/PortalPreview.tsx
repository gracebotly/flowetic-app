"use client";

import { useState, useEffect, useMemo, useCallback, type ComponentType, type ReactNode } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Loader2,
  Eye,
  RotateCcw,
  Maximize2,
  Info,
} from "lucide-react";
import { Badge } from "@tremor/react";
import { motion } from "framer-motion";

import { PortalShell } from "@/components/portals/PortalShell";
import { VoicePerformanceSkeleton } from "@/components/portals/skeletons/VoicePerformanceSkeleton";
import { WorkflowOperationsSkeleton } from "@/components/portals/skeletons/WorkflowOperationsSkeleton";
import { ROISummarySkeleton } from "@/components/portals/skeletons/ROISummarySkeleton";
import { CombinedOverviewSkeleton } from "@/components/portals/skeletons/CombinedOverviewSkeleton";
import { getSkeletonForPlatform } from "@/lib/portals/platformToSkeleton";
import { transformDataForSkeleton, type SkeletonData, type PortalEvent } from "@/lib/portals/transformData";

import type { InputField } from "@/lib/products/types";

type DeviceMode = "desktop" | "tablet" | "mobile";

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
  inputSchema?: InputField[];
}

interface Branding {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  welcome_message: string | null;
  brand_footer: string | null;
  tenant_name: string | null;
}

const DEVICES: Record<DeviceMode, { width: number; label: string; icon: typeof Monitor }> = {
  desktop: { width: 1280, label: "Desktop", icon: Monitor },
  tablet: { width: 768, label: "Tablet", icon: Tablet },
  mobile: { width: 375, label: "Mobile", icon: Smartphone },
};

const SKELETON_COMPONENTS: Record<string, ComponentType<SkeletonProps>> = {
  "voice-performance": VoicePerformanceSkeleton,
  "workflow-operations": WorkflowOperationsSkeleton,
  "roi-summary": ROISummarySkeleton,
  "combined-overview": CombinedOverviewSkeleton,
};

function generateSampleVoiceData(): PreviewEvent[] {
  const now = Date.now();
  const assistants = ["Sales Assistant", "Support Agent", "Booking Bot"];
  const endedReasons = ["customer-ended-call", "assistant-ended-call", "silence-timed-out"];
  return Array.from({ length: 24 }, (_, i) => {
    const isSuccess = Math.random() > 0.15;
    const durationMs = Math.floor(45000 + Math.random() * 300000);
    return {
      id: `sample-${i}`,
      type: "call.completed",
      name: "call.completed",
      value: isSuccess ? 1 : 0,
      unit: "count",
      text: `Sample call ${i + 1}`,
      state: {
        status: isSuccess ? "completed" : "failed",
        duration_ms: durationMs,
        workflow_name: assistants[i % assistants.length],
        workflow_id: `asst-${(i % assistants.length) + 1}`,
        execution_id: `call-sample-${i}`,
        started_at: new Date(now - i * 3600000).toISOString(),
        ended_at: new Date(now - i * 3600000 + durationMs).toISOString(),
        ended_reason: endedReasons[i % endedReasons.length],
        cost: Number((0.03 + Math.random() * 0.15).toFixed(4)),
        platform: "vapi",
      },
      labels: { platform: "vapi" },
      timestamp: new Date(now - i * 3600000).toISOString(),
    };
  });
}

function generateSampleWorkflowData(): PreviewEvent[] {
  const now = Date.now();
  const sampleNames = [
    "Lead Enrichment Pipeline",
    "Daily Report Generator",
    "Slack Notification Flow",
    "CRM Sync Workflow",
    "Invoice Processor",
  ];
  return Array.from({ length: 30 }, (_, i) => {
    const isSuccess = Math.random() > 0.08;
    return {
      id: `sample-${i}`,
      type: "workflow_execution",
      name: "workflow_execution",
      value: isSuccess ? 1 : 0,
      unit: "count",
      text: `Execution ${i + 1}`,
      state: {
        status: isSuccess ? "success" : "error",
        duration_ms: Math.floor(800 + Math.random() * 4000),
        workflow_name: sampleNames[i % sampleNames.length],
        workflow_id: `wf-${(i % sampleNames.length) + 1}`,
        execution_id: `exec-sample-${i}`,
        started_at: new Date(now - i * 1800000).toISOString(),
        ended_at: new Date(now - i * 1800000 + 2000).toISOString(),
        error_message: isSuccess ? undefined : "Sample: timeout after 30s",
        platform: "make",
      },
      labels: { platform: "make", workflow_name: sampleNames[i % sampleNames.length] },
      timestamp: new Date(now - i * 1800000).toISOString(),
    };
  });
}

function BrowserChrome({
  mode,
  entityName,
  children,
}: {
  mode: DeviceMode;
  entityName: string;
  children: ReactNode;
}) {
  if (mode === "desktop") {
    return (
      <div className="overflow-hidden rounded-xl border border-tremor-border shadow-2xl dark:border-dark-tremor-border">
        <div className="flex items-center gap-2 border-b border-tremor-border bg-tremor-background-subtle px-4 py-2.5 dark:border-dark-tremor-border dark:bg-dark-tremor-background-subtle">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="ml-4 flex-1 rounded-md bg-tremor-background px-3 py-1 dark:bg-dark-tremor-background">
            <span className="font-mono text-[11px] text-tremor-content dark:text-dark-tremor-content">
              youragency.com/client/{entityName || "portal-preview"}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-950">{children}</div>
      </div>
    );
  }

  if (mode === "tablet") {
    return (
      <div className="overflow-hidden rounded-2xl border-[3px] border-slate-700 shadow-2xl dark:border-slate-500">
        <div className="flex justify-center bg-slate-700 py-1.5 dark:bg-slate-500">
          <div className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />
        </div>
        <div className="bg-white dark:bg-slate-950">{children}</div>
        <div className="flex justify-center bg-slate-700 py-2 dark:bg-slate-500">
          <div className="h-1 w-8 rounded-full bg-slate-500 dark:bg-slate-400" />
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
  inputSchema,
}: PortalPreviewProps) {
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [branding, setBranding] = useState<Branding | null>(null);
  const [events, setEvents] = useState<PreviewEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [activeTab, setActiveTab] = useState<"portal" | "product">(
    surfaceType === "runner" ? "product" : "portal"
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const skeletonId = useMemo(() => getSkeletonForPlatform(platformType), [platformType]);
  const SkeletonComponent = SKELETON_COMPONENTS[skeletonId];

  useEffect(() => {
    let mounted = true;

    async function fetchPreviewData() {
      setLoading(true);
      try {
        const brandingRes = await fetch("/api/settings/branding");
        const brandingData: Branding | null = brandingRes.ok ? await brandingRes.json() : null;

        const eventsRes = await fetch(`/api/events?source_id=${sourceId}&limit=50`);
        const eventsData: unknown = eventsRes.ok ? await eventsRes.json() : null;

        if (!mounted) return;

        setBranding(brandingData);

        const maybeObject = (eventsData && typeof eventsData === "object") ? (eventsData as { events?: unknown; data?: unknown }) : null;
        const realEvents = maybeObject?.events ?? maybeObject?.data ?? eventsData;

        if (Array.isArray(realEvents) && realEvents.length > 0) {
          setEvents(realEvents as PreviewEvent[]);
          setUsingSampleData(false);
        } else {
          const isVoice = platformType === "vapi" || platformType === "retell";
          setEvents(isVoice ? generateSampleVoiceData() : generateSampleWorkflowData());
          setUsingSampleData(true);
        }
      } catch {
        const isVoice = platformType === "vapi" || platformType === "retell";
        setEvents(isVoice ? generateSampleVoiceData() : generateSampleWorkflowData());
        setUsingSampleData(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPreviewData();
    return () => {
      mounted = false;
    };
  }, [sourceId, platformType, refreshKey]);

  const transformedData = useMemo(() => {
    if (!events || !skeletonId) return null;
    try {
      return transformDataForSkeleton(events, skeletonId, platformType);
    } catch {
      return null;
    }
  }, [events, skeletonId, platformType]);

  const containerMaxWidth = device === "desktop" ? 1280 : device === "tablet" ? 900 : 900;
  const deviceWidth = DEVICES[device].width;
  const WIZARD_USABLE_WIDTH = 700;
  const scale = deviceWidth > WIZARD_USABLE_WIDTH
    ? WIZARD_USABLE_WIDTH / deviceWidth
    : 1;
  const scaledHeight = device === "mobile" ? 900 : device === "tablet" ? 1100 : 1000;

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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

  const showAnalytics = surfaceType === "analytics" || surfaceType === "both";
  const showProduct = surfaceType === "runner" || surfaceType === "both";

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
          href={`/portal-preview?source_id=${sourceId}&platform=${platformType}&surface=${surfaceType}&entity_name=${encodeURIComponent(entityName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer flex items-center gap-1.5 rounded-tremor-default border border-tremor-border px-3 py-1.5 text-xs font-medium text-tremor-content-strong transition-colors duration-200 hover:bg-tremor-background-subtle dark:border-dark-tremor-border dark:text-dark-tremor-content-strong dark:hover:bg-dark-tremor-background-subtle"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full preview
        </a>
      </div>

      {surfaceType === "both" && (
        <div className="flex gap-1 rounded-lg bg-tremor-background-subtle p-1 dark:bg-dark-tremor-background-subtle">
          <button
            onClick={() => setActiveTab("portal")}
            className={`cursor-pointer flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              activeTab === "portal"
                ? "bg-white text-tremor-content-strong shadow-sm dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong"
                : "text-tremor-content hover:text-tremor-content-strong dark:text-dark-tremor-content dark:hover:text-dark-tremor-content-strong"
            }`}
          >
            <Eye className="mr-1.5 inline-block h-3.5 w-3.5" />
            Analytics Dashboard
          </button>
          <button
            onClick={() => setActiveTab("product")}
            className={`cursor-pointer flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              activeTab === "product"
                ? "bg-white text-tremor-content-strong shadow-sm dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong"
                : "text-tremor-content hover:text-tremor-content-strong dark:text-dark-tremor-content dark:hover:text-dark-tremor-content-strong"
            }`}
          >
            <Maximize2 className="mr-1.5 inline-block h-3.5 w-3.5" />
            Product Page
          </button>
        </div>
      )}

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
          {usingSampleData && (
            <Badge size="xs" color="amber">
              Sample data
            </Badge>
          )}
          <button
            onClick={handleRefresh}
            className="cursor-pointer rounded-md p-1.5 text-tremor-content transition-colors duration-200 hover:text-tremor-content-strong dark:text-dark-tremor-content dark:hover:text-dark-tremor-content-strong"
            title="Refresh preview"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ width: Math.min(deviceWidth * scale, containerMaxWidth) }}
        >
          <BrowserChrome mode={device} entityName={entityName}>
            <div
              style={{
                width: deviceWidth,
                height: scaledHeight,
                maxHeight: 1200,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {showAnalytics && activeTab === "portal" && (
                <PortalShell
                  portalName={entityName || "Your Portal"}
                  tenantName={branding?.tenant_name || "Your Agency"}
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
                        portalName: branding?.tenant_name || entityName,
                      }}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-gray-500">
                      Unable to render preview for this platform.
                    </div>
                  )}
                </PortalShell>
              )}

              {showProduct && activeTab === "product" && (
                <div className="p-6">
                  <div className="mx-auto max-w-2xl">
                    <div className="mb-8 text-center">
                      {branding?.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={branding.logo_url}
                          alt="Agency logo"
                          className="mx-auto mb-4 h-10 object-contain"
                        />
                      )}
                      <h1
                        className="text-2xl font-bold"
                        style={{ color: branding?.primary_color || "#1a1a1a" }}
                      >
                        {entityName}
                      </h1>
                      <p className="mt-2 text-sm text-gray-600">Fill out the form below to get started</p>
                    </div>

                    {inputSchema && inputSchema.length > 0 ? (
                      <div className="space-y-3">
                        {(inputSchema ?? []).map((field, i) => (
                          <div key={field.name} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-500">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-900">{field.label}</span>
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">{field.type}</span>
                            </div>
                            {field.required && (
                              <span className="text-[10px] font-medium text-red-400">Required</span>
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-gray-400">Your customers will fill out a step-by-step form.</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                        <Info className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-3 text-sm text-gray-500">
                          Form fields will appear here once auto-detected from your workflow configuration.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </BrowserChrome>
        </motion.div>
      </div>

      {usingSampleData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Showing sample data because this agent has no events yet. Once your client starts using the portal, real data will populate automatically.
          </p>
        </motion.div>
      )}
    </div>
  );
}
