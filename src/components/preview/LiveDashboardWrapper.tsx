"use client";

import React, { useMemo, useState } from "react";
import { ResponsiveDashboardRenderer } from "./ResponsiveDashboardRenderer";
import { transformDataForComponents } from "@/lib/dashboard/transformDataForComponents";
import { validateBeforeRender } from "@/lib/spec/validateBeforeRender";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import type { DeviceMode } from "@/components/vibe/editor";

interface LiveDashboardWrapperProps {
  /** safeSpec = already transformed + validated by server (SSR parity) */
  safeSpec: any;
  /** Raw spec from version.spec_json — used for re-transformation on new events */
  rawSpec: any;
  initialEvents: any[];
  designTokens: any;
  sourceId: string;
  interfaceId: string;
  deviceMode?: DeviceMode;
  isEditing?: boolean;
}

export function LiveDashboardWrapper({
  safeSpec,
  rawSpec,
  initialEvents,
  designTokens,
  sourceId,
  interfaceId,
  deviceMode = "desktop",
  isEditing = false,
}: LiveDashboardWrapperProps) {
  // --- Realtime subscription ---
  const { events, connectionStatus, connectionError, newEventCount, resetCount } =
    useRealtimeEvents({ sourceId, interfaceId, initialEvents });

  // --- Date range filter (Phase 2 ready) ---
  const [dateRange, setDateRange] = useState<{
    preset: string;
    from?: Date;
    to?: Date;
  }>({ preset: "all" });

  // --- Filter events by date range ---
  const filteredEvents = useMemo(() => {
    if (dateRange.preset === "all") return events;

    const now = new Date();
    let cutoff: Date;

    switch (dateRange.preset) {
      case "24h":
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        return events.filter((e) => {
          const ts = new Date(e.timestamp || e.created_at);
          return (
            (!dateRange.from || ts >= dateRange.from) &&
            (!dateRange.to || ts <= dateRange.to)
          );
        });
      default:
        return events;
    }

    return events.filter((e) => {
      const ts = new Date(e.timestamp || e.created_at);
      return ts >= cutoff;
    });
  }, [events, dateRange]);

  // --- Spec computation ---
  // Key insight: on first render (no new events yet), use safeSpec directly
  // to guarantee SSR/client parity. Only re-transform when new events arrive.
  const hasNewEvents = newEventCount > 0;

  const enrichedSpec = useMemo(() => {
    if (!hasNewEvents) {
      // No new events since SSR — use server-computed safeSpec as-is
      return safeSpec;
    }
    // New events arrived via Realtime — re-transform from rawSpec
    if (!rawSpec || filteredEvents.length === 0) return safeSpec;
    const transformed = transformDataForComponents(rawSpec, filteredEvents);
    const validationResult = validateBeforeRender(transformed);
    return validationResult.spec ?? transformed;
  }, [safeSpec, rawSpec, filteredEvents, hasNewEvents]);

  // --- Connection status indicator ---
  const statusConfig = {
    connecting: { color: "bg-yellow-500", label: "Connecting", animate: true },
    connected: { color: "bg-green-500", label: "Live", animate: true },
    stale: { color: "bg-amber-500", label: "Stale", animate: false },
    error: { color: "bg-red-500", label: "Offline", animate: false },
  };

  const status = statusConfig[connectionStatus];

  return (
    <div className="relative">
      {/* Connection status indicator */}
      <div
        className="absolute top-2 right-2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 backdrop-blur-sm text-xs cursor-pointer"
        onClick={resetCount}
        title={
          connectionError
            ? `Error: ${connectionError}`
            : connectionStatus === "stale"
              ? "No events received for 30s"
              : newEventCount > 0
                ? "Click to reset counter"
                : "Listening for events"
        }
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${status.color} ${status.animate ? "animate-pulse" : ""}`}
        />
        <span style={{ color: "var(--gf-muted, #6b7280)" }}>{status.label}</span>
        {newEventCount > 0 && (
          <span style={{ color: "var(--gf-muted, #6b7280)" }}>
            +{newEventCount}
          </span>
        )}
      </div>

      {/* Phase 2 slot: <DateRangeFilter value={dateRange} onChange={setDateRange} /> */}

      {/* Dashboard renderer — unchanged component */}
      <ResponsiveDashboardRenderer
        spec={enrichedSpec}
        designTokens={designTokens}
        deviceMode={deviceMode}
        isEditing={isEditing}
      />
    </div>
  );
}
