"use client";

import { useEffect, useRef } from "react";
import { X, Clock, Tag, User as UserIcon, Zap } from "lucide-react";
import { StatusDot } from "@/components/activity/StatusDot";
import { PayloadViewer } from "@/components/activity/PayloadViewer";
import { EntityLinks } from "@/components/activity/EntityLinks";

interface ActivityEvent {
  id: string;
  tenant_id?: string;
  actor_id: string | null;
  actor_type: string;
  category: string;
  action: string;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  client_id: string | null;
  portal_id: string | null;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  _color: string;
  _icon: string;
}

interface EventDrawerProps {
  event: ActivityEvent | null;
  onClose: () => void;
}

function formatFullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function EventDrawer({ event, onClose }: EventDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const isOpen = event !== null;

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap — keep focus in the drawer
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isOpen, event?.id]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 transition-opacity"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-in-out outline-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {event && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  <StatusDot color={event._color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">
                    {event.message}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatFullTimestamp(event.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3">
                <MetaItem
                  icon={Tag}
                  label="Category"
                  value={event.category}
                />
                <MetaItem
                  icon={Zap}
                  label="Action"
                  value={event.action}
                />
                <MetaItem
                  icon={UserIcon}
                  label="Actor"
                  value={event.actor_type}
                />
                <MetaItem
                  icon={Clock}
                  label="Status"
                  value={event.status}
                  statusColor={event._color}
                />
                {event.entity_type && (
                  <MetaItem
                    icon={Tag}
                    label="Entity Type"
                    value={event.entity_type}
                  />
                )}
                {event.details?.duration_ms != null && (
                  <MetaItem
                    icon={Clock}
                    label="Duration"
                    value={formatDuration(
                      Number(event.details.duration_ms),
                    )}
                  />
                )}
              </div>

              {/* Entity Links */}
              <EntityLinks
                entityType={event.entity_type}
                entityId={event.entity_id}
                entityName={event.entity_name}
                clientId={event.client_id}
                offeringId={event.portal_id}
              />

              {/* Payload Viewer */}
              <PayloadViewer data={event.details} />
            </div>

            {/* Footer — keyboard hint */}
            <div className="border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400 text-center">
                <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono">
                  ↑
                </kbd>{" "}
                <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono">
                  ↓
                </kbd>{" "}
                navigate events{" · "}
                <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono">
                  Esc
                </kbd>{" "}
                close
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Small metadata item ──────────────────────────────────── */

function MetaItem({
  icon: Icon,
  label,
  value,
  statusColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  statusColor?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-gray-400" />
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {statusColor && <StatusDot color={statusColor} size="sm" />}
        <span className="text-sm font-medium text-gray-800 capitalize">
          {value}
        </span>
      </div>
    </div>
  );
}
