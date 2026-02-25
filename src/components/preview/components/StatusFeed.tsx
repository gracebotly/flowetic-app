"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Clock, Loader, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle } from "../componentRegistry";

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: LucideIcon; label: string }> = {
  success: { color: "#16a34a", bg: "#16a34a15", icon: CheckCircle2, label: "Success" },
  completed: { color: "#16a34a", bg: "#16a34a15", icon: CheckCircle2, label: "Completed" },
  active: { color: "#16a34a", bg: "#16a34a15", icon: CheckCircle2, label: "Active" },
  ok: { color: "#16a34a", bg: "#16a34a15", icon: CheckCircle2, label: "OK" },
  error: { color: "#dc2626", bg: "#dc262615", icon: AlertTriangle, label: "Error" },
  failed: { color: "#dc2626", bg: "#dc262615", icon: AlertTriangle, label: "Failed" },
  critical: { color: "#dc2626", bg: "#dc262615", icon: AlertTriangle, label: "Critical" },
  warning: { color: "#f59e0b", bg: "#f59e0b15", icon: AlertTriangle, label: "Warning" },
  pending: { color: "#f59e0b", bg: "#f59e0b15", icon: Clock, label: "Pending" },
  waiting: { color: "#f59e0b", bg: "#f59e0b15", icon: Clock, label: "Waiting" },
  info: { color: "#3b82f6", bg: "#3b82f615", icon: Activity, label: "Info" },
  running: { color: "#3b82f6", bg: "#3b82f615", icon: Loader, label: "Running" },
  processing: { color: "#3b82f6", bg: "#3b82f615", icon: Loader, label: "Processing" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? {
    color: "#6b7280", bg: "#6b728015", icon: Radio, label: status || "Unknown",
  };
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

function truncateMessage(msg: string, max = 45): string {
  if (!msg || msg.length <= max) return msg || "—";
  return msg.slice(0, max) + "…";
}

export default function StatusFeedRenderer({ component, designTokens: dt, deviceMode, isEditing, onClick }: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const textColor = dt.colors?.text ?? "#111827";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const { props } = component;
  const title = props?.title ?? "Live Feed";
  const feedItems = props?.feedItems ?? [];
  const maxItems = deviceMode === "mobile" ? 5 : 10;

  return (
    <motion.div
      className={`h-full ${isEditing ? "cursor-pointer" : ""}`}
      style={{ ...cardStyle, ...(isCardHovered ? cardHoverStyle : {}) }}
      data-component-type="StatusFeed"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-4"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: textColor, fontFamily: headingFont || undefined }}>
            {title}
          </h3>
          {props?.pollingInterval && (
            <span className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#16a34a12", color: "#16a34a" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Table header */}
        {feedItems.length > 0 && (
          <div className="grid gap-2 pb-2 mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              gridTemplateColumns: deviceMode === "mobile" ? "60px 1fr 60px" : "80px 1fr 100px",
              color: `${textColor}55`,
              borderBottom: `1px solid ${textColor}10`,
              fontFamily: bodyFont || undefined,
            }}>
            <div>Status</div>
            <div>Event</div>
            <div className="text-right">Time</div>
          </div>
        )}

        {/* Rows */}
        <div className="max-h-[300px] overflow-y-auto">
          {feedItems.length > 0 ? feedItems.slice(0, maxItems).map((item: any, idx: number) => {
            const cfg = getStatusConfig(item.status);
            const StatusIcon = cfg.icon;
            const isRowHovered = hoveredRow === idx;

            return (
              <div
                key={idx}
                className="grid gap-2 py-2 px-1 rounded-md transition-colors duration-150"
                style={{
                  gridTemplateColumns: deviceMode === "mobile" ? "60px 1fr 60px" : "80px 1fr 100px",
                  backgroundColor: isRowHovered
                    ? `${primary}08`
                    : idx % 2 === 1
                      ? `${textColor}03`
                      : "transparent",
                  borderBottom: `1px solid ${textColor}06`,
                }}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Status badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    <StatusIcon size={10} strokeWidth={2} />
                    {deviceMode !== "mobile" && cfg.label}
                  </span>
                </div>

                {/* Message */}
                <div
                  className="text-xs truncate self-center"
                  style={{ color: `${textColor}cc`, fontFamily: bodyFont || undefined }}
                  title={item.message}
                >
                  {truncateMessage(item.message, deviceMode === "mobile" ? 30 : 50)}
                </div>

                {/* Time */}
                <div
                  className="text-[10px] text-right self-center"
                  style={{ color: `${textColor}44` }}
                >
                  {formatRelativeTime(item.timestamp)}
                </div>
              </div>
            );
          }) : (
            /* Empty state skeleton */
            [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid gap-2 py-2"
                style={{ gridTemplateColumns: deviceMode === "mobile" ? "60px 1fr 60px" : "80px 1fr 100px" }}>
                <div className="h-5 w-14 rounded-full animate-pulse" style={{ backgroundColor: `${textColor}10` }} />
                <div className="h-3 rounded animate-pulse self-center" style={{ backgroundColor: `${textColor}08`, width: `${50 + i * 8}%` }} />
                <div className="h-3 w-12 rounded animate-pulse self-center ml-auto" style={{ backgroundColor: `${textColor}06` }} />
              </div>
            ))
          )}
        </div>

        {/* Footer count */}
        {feedItems.length > maxItems && (
          <div className="text-[10px] text-center mt-2 pt-2"
            style={{ color: `${textColor}44`, borderTop: `1px solid ${textColor}08` }}>
            Showing {maxItems} of {feedItems.length} events
          </div>
        )}
      </div>
    </motion.div>
  );
}
