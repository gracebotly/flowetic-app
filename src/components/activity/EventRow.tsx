"use client";

import { StatusDot } from "@/components/activity/StatusDot";
import { EntityBadge } from "@/components/activity/EntityBadge";
import {
  Eye,
  Zap,
  Package,
  Users,
  Plug,
  UserPlus,
  Settings,
  CreditCard,
  Activity,
} from "lucide-react";

interface ActivityEvent {
  id: string;
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

interface EventRowProps {
  event: ActivityEvent;
  isSelected?: boolean;
  onClick?: () => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  Zap,
  Package,
  Users,
  Plug,
  UserPlus,
  Settings,
  CreditCard,
  Activity,
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EventRow({ event, isSelected, onClick }: EventRowProps) {
  const Icon = ICON_MAP[event._icon] ?? Activity;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group flex items-start gap-3 rounded-lg px-4 py-3 transition cursor-pointer ${
        isSelected
          ? "bg-blue-50 ring-1 ring-blue-200"
          : "hover:bg-gray-50"
      }`}
    >
      {/* Status dot */}
      <div className="mt-0.5 shrink-0">
        <StatusDot color={event._color} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Message row */}
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <p className="text-sm text-gray-900">{event.message}</p>
        </div>

        {/* Badges row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* Entity badge (the thing that was acted on) */}
          {event.entity_type && (event.entity_id || event.entity_name) && (
            <EntityBadge
              type={event.entity_type}
              id={event.entity_id}
              name={event.entity_name}
            />
          )}

          {/* Client badge (if different from entity) */}
          {event.client_id && event.entity_type !== "client" && (
            <EntityBadge
              type="client"
              id={event.client_id}
              name={null}
            />
          )}

          {/* Offering badge (if different from entity) */}
          {event.portal_id && event.entity_type !== "portal" && (
            <EntityBadge
              type="portal"
              id={event.portal_id}
              name={null}
            />
          )}

          {/* Category pill */}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {event.category}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="shrink-0 text-right">
        <p
          className="text-xs text-gray-400"
          title={formatFullTimestamp(event.created_at)}
        >
          {formatRelative(event.created_at)}
        </p>
      </div>
    </div>
  );
}
