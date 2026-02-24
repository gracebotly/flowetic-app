"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle } from "../componentRegistry";

const STATUS_COLORS: Record<string, string> = {
  success: "#22c55e", completed: "#22c55e", active: "#22c55e", ok: "#22c55e",
  error: "#ef4444", failed: "#ef4444", critical: "#ef4444",
  warning: "#f59e0b", pending: "#f59e0b", waiting: "#f59e0b",
  info: "#3b82f6", running: "#3b82f6", processing: "#3b82f6",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status?.toLowerCase()] || "#6b7280";
}

function formatRelativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  } catch { return ts || "—"; }
}

export default function StatusFeedRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const { props } = component;
  const title = props?.title ?? "Live Feed";
  const feedItems = props?.feedItems ?? [];

  return (
    <div className={`h-full border transition-all duration-200 ${isEditing ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""}`} style={cardStyle} data-component-type="StatusFeed" onClick={isEditing ? onClick : undefined}>
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: textColor, fontFamily: headingFont || undefined }}>{title}</h3>
          {props?.pollingInterval && <span className="flex items-center gap-1 text-xs" style={{ color: "#22c55e" }}><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>}
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {feedItems.length > 0 ? feedItems.slice(0, deviceMode === "mobile" ? 5 : 10).map((item: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 py-2" style={{ borderBottom: `1px solid ${textColor}08` }}>
              <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: getStatusColor(item.status) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: textColor, fontFamily: bodyFont || undefined }}>{item.message}</div>
                <div className="text-xs mt-0.5" style={{ color: `${textColor}55` }}><span className="font-medium" style={{ color: getStatusColor(item.status) }}>{item.status}</span>{" · "}{formatRelativeTime(item.timestamp)}</div>
              </div>
            </div>
          )) : (
            [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: `${textColor}20` }} />
                <div className="flex-1"><div className="h-3 rounded animate-pulse mb-1" style={{ backgroundColor: `${textColor}10`, width: `${60 + i * 8}%` }} /><div className="h-2 rounded animate-pulse" style={{ backgroundColor: `${textColor}08`, width: "40%" }} /></div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
