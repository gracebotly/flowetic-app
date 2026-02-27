"use client";

import React from "react";
import { Download, RefreshCw } from "lucide-react";

interface DashboardActionsProps {
  onRefresh: () => void;
  events: any[];
  dashboardTitle?: string;
  isRefreshing?: boolean;
}

function exportCSV(events: any[], title?: string) {
  if (!events.length) return;

  const headers = Object.keys(events[0]);
  const csvRows = [
    headers.join(","),
    ...events.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `${(title || "dashboard").replace(/\s+/g, "-").toLowerCase()}-export-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DashboardActions({
  onRefresh,
  events,
  dashboardTitle,
  isRefreshing = false,
}: DashboardActionsProps) {
  const buttonStyle: React.CSSProperties = {
    color: "var(--gf-text, #111827)",
    backgroundColor: "var(--gf-surface, #ffffff)",
    border: "1px solid var(--gf-border, #e5e7eb)",
    fontFamily: "var(--gf-font-body, inherit)",
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 hover:opacity-80 disabled:opacity-50"
        style={buttonStyle}
        title="Refresh data"
      >
        <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
      <button
        onClick={() => exportCSV(events, dashboardTitle)}
        disabled={events.length === 0}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        style={buttonStyle}
        title="Export data as CSV"
      >
        <Download size={12} />
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );
}
