"use client";

import React from "react";
import { DateRangeFilter } from "./DateRangeFilter";
import { DashboardActions } from "./DashboardActions";

type ConnectionStatus = "connecting" | "connected" | "stale" | "error";

interface DashboardControlBarProps {
  dateRange: { preset: string; from?: Date; to?: Date };
  onDateRangeChange: (range: { preset: string; from?: Date; to?: Date }) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  events: any[];
  filteredEventCount: number;
  totalEventCount: number;
  dashboardTitle?: string;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  newEventCount: number;
  onResetCount: () => void;
}

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string; animate: boolean }> = {
  connecting: { color: "bg-yellow-500", label: "Connecting", animate: true },
  connected: { color: "bg-green-500", label: "Live", animate: true },
  stale: { color: "bg-amber-500", label: "Stale", animate: false },
  error: { color: "bg-red-500", label: "Offline", animate: false },
};

export function DashboardControlBar({
  dateRange,
  onDateRangeChange,
  onRefresh,
  isRefreshing,
  events,
  filteredEventCount,
  totalEventCount,
  dashboardTitle,
  connectionStatus,
  connectionError,
  newEventCount,
  onResetCount,
}: DashboardControlBarProps) {
  const status = STATUS_CONFIG[connectionStatus];

  return (
    <div
      className="flex items-center justify-between px-6 py-2.5"
      style={{ borderBottom: "1px solid var(--gf-border, #e5e7eb)" }}
    >
      <DateRangeFilter
        value={dateRange}
        onChange={onDateRangeChange}
        eventCount={filteredEventCount}
        totalCount={totalEventCount}
      />

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
          onClick={onResetCount}
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
          <span style={{ color: "var(--gf-muted, #6b7280)" }}>
            {status.label}
          </span>
          {newEventCount > 0 && (
            <span style={{ color: "var(--gf-muted, #6b7280)" }}>
              +{newEventCount}
            </span>
          )}
        </div>

        <DashboardActions
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          events={events}
          dashboardTitle={dashboardTitle}
        />
      </div>
    </div>
  );
}
