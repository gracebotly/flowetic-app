"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, ClipboardList } from "lucide-react";
import { StatusDot } from "@/components/activity/StatusDot";
import { EntityBadge } from "@/components/activity/EntityBadge";

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

interface ScopedActivityFeedProps {
  clientId?: string;
  offeringId?: string;
  limit?: number;
}

const COLOR_MAP: Record<string, string> = {
  success: "emerald",
  warning: "amber",
  error: "red",
  info: "blue",
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

export function ScopedActivityFeed({
  clientId,
  offeringId,
  limit = 20,
}: ScopedActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set("client_id", clientId);
      if (offeringId) params.set("portal_id", offeringId);
      params.set("limit", String(limit));

      const res = await fetch(`/api/activity?${params}`);
      const json = await res.json();

      if (json.ok && json.events) {
        setEvents(json.events as ActivityEvent[]);
      }
    } catch {
      // Silent fail — activity is non-critical
    }
    setLoading(false);
  }, [clientId, offeringId, limit]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchEvents();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchEvents]);

  const viewAllParams = new URLSearchParams();
  if (clientId) viewAllParams.set("client_id", clientId);
  if (offeringId) viewAllParams.set("portal_id", offeringId);
  const viewAllHref = viewAllParams.toString()
    ? `/control-panel/activity?${viewAllParams}`
    : "/control-panel/activity";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-500">
          No activity yet
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Events will appear here as actions are taken.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => {
        const color = COLOR_MAP[event.status] ?? "gray";
        return (
          <div
            key={event.id}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition"
          >
            <div className="mt-0.5 shrink-0">
              <StatusDot color={color} size="sm" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900">{event.message}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {event.entity_type &&
                  (event.entity_id || event.entity_name) && (
                    <EntityBadge
                      type={event.entity_type}
                      id={event.entity_id}
                      name={event.entity_name}
                    />
                  )}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {event.category}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-xs text-gray-400">
              {formatRelative(event.created_at)}
            </div>
          </div>
        );
      })}

      <div className="mt-4 text-center">
        <Link
          href={viewAllHref}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          View all in Activity Tab →
        </Link>
      </div>
    </div>
  );
}
