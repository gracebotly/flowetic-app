"use client";

import React from "react";
import { DashboardControlBar } from "@/components/preview/controls/DashboardControlBar";
import { useLiveDashboard } from "@/components/preview/LiveDashboardWrapper";

export function PreviewControlBar() {
  const {
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
    dashboardTitle,
  } = useLiveDashboard();

  return (
    <DashboardControlBar
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      events={filteredEvents}
      filteredEventCount={filteredEvents.length}
      totalEventCount={events.length}
      dashboardTitle={dashboardTitle}
      connectionStatus={connectionStatus}
      connectionError={connectionError}
      newEventCount={newEventCount}
      onResetCount={resetCount}
    />
  );
}
