"use client";

import React, { useMemo, useState, useCallback } from "react";
import { ResponsiveDashboardRenderer } from "./ResponsiveDashboardRenderer";
import { transformDataForComponents } from "@/lib/dashboard/transformDataForComponents";
import { validateBeforeRender } from "@/lib/spec/validateBeforeRender";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { createClient } from "@/lib/supabase/client";
import type { DeviceMode } from "@/components/vibe/editor";

interface LiveDashboardWrapperProps {
  safeSpec: any;
  rawSpec: any;
  initialEvents: any[];
  designTokens: any;
  sourceId: string;
  interfaceId: string;
  deviceMode?: DeviceMode;
  isEditing?: boolean;
  children?: React.ReactNode;
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
  children,
}: LiveDashboardWrapperProps) {
  const { events, setEvents, connectionStatus, connectionError, newEventCount, resetCount } =
    useRealtimeEvents({ sourceId, interfaceId, initialEvents });

  const [dateRange, setDateRange] = useState<{
    preset: string;
    from?: Date;
    to?: Date;
  }>({ preset: "all" });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("source_id", sourceId)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (data && data.length > 0) {
        const flattened = data.map((evt: any) => {
          const flat: Record<string, any> = { ...evt };
          if (evt.state && typeof evt.state === "object") {
            for (const [key, value] of Object.entries(evt.state)) {
              if (flat[key] == null || flat[key] === "") flat[key] = value;
            }
            if (flat.duration_ms != null) flat.duration_ms = Number(flat.duration_ms);
          }
          if (evt.labels && typeof evt.labels === "object") {
            for (const [key, value] of Object.entries(evt.labels)) {
              if (flat[key] == null || flat[key] === "") flat[key] = value;
            }
          }
          return flat;
        });
        setEvents(flattened);
      }
    } catch (err) {
      console.error("[LiveDashboardWrapper] Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [sourceId, setEvents]);

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

  const enrichedSpec = useMemo(() => {
    if (!rawSpec) return safeSpec;
    if (filteredEvents.length === 0) {
      return safeSpec;
    }
    const transformed = transformDataForComponents(rawSpec, filteredEvents);
    const validationResult = validateBeforeRender(transformed);
    return validationResult.spec ?? transformed;
  }, [safeSpec, rawSpec, filteredEvents]);

  const isFilteredEmpty = dateRange.preset !== "all" && filteredEvents.length === 0 && events.length > 0;

  const PRESET_LABELS: Record<string, string> = {
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
  };

  return (
    <LiveDashboardContext.Provider
      value={{
        dateRange,
        setDateRange,
        handleRefresh,
        isRefreshing,
        events,
        filteredEvents,
        connectionStatus,
        connectionError,
        newEventCount,
        resetCount,
        dashboardTitle: rawSpec?.title,
      }}
    >
      {children}

      <div className="relative">
        {isFilteredEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, var(--gf-primary, #3b82f6)12, var(--gf-primary, #3b82f6)06)",
                border: "1px solid var(--gf-border, #e5e7eb)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gf-muted, #6b7280)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p
              className="text-sm font-medium mb-1"
              style={{ color: "var(--gf-text, #111827)" }}
            >
              No events in the last {PRESET_LABELS[dateRange.preset] ?? dateRange.preset}
            </p>
            <p
              className="text-xs mb-4"
              style={{ color: "var(--gf-muted, #6b7280)" }}
            >
              {events.length} event{events.length !== 1 ? "s" : ""} exist outside this range
            </p>
            <button
              onClick={() => setDateRange({ preset: "all" })}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-all hover:opacity-80"
              style={{
                color: "var(--gf-primary, #3b82f6)",
                border: "1px solid var(--gf-primary, #3b82f6)",
                backgroundColor: "transparent",
              }}
            >
              Show all time
            </button>
          </div>
        ) : (
          <ResponsiveDashboardRenderer
            spec={enrichedSpec}
            designTokens={designTokens}
            deviceMode={deviceMode}
            isEditing={isEditing}
          />
        )}
      </div>
    </LiveDashboardContext.Provider>
  );
}

interface LiveDashboardContextValue {
  dateRange: { preset: string; from?: Date; to?: Date };
  setDateRange: (range: { preset: string; from?: Date; to?: Date }) => void;
  handleRefresh: () => void;
  isRefreshing: boolean;
  events: any[];
  filteredEvents: any[];
  connectionStatus: "connecting" | "connected" | "stale" | "error";
  connectionError: string | null;
  newEventCount: number;
  resetCount: () => void;
  dashboardTitle?: string;
}

const LiveDashboardContext = React.createContext<LiveDashboardContextValue | null>(null);

export function useLiveDashboard() {
  const ctx = React.useContext(LiveDashboardContext);
  if (!ctx) throw new Error("useLiveDashboard must be used within LiveDashboardWrapper");
  return ctx;
}
