"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

interface ActivityEvent {
  id: string;
  type: string;
  status: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface ActivityTabProps {
  clientId: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityTab({ clientId }: ActivityTabProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase
          .from("activity_events")
          .select("id, type, status, message, details, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          setEvents(data as ActivityEvent[]);
        }
      } catch {
        // Table might not have data yet.
      }
      setLoading(false);
    };
    void fetchActivity();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <Clock className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-500">No activity yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Events will appear here as this client views portals and uses products.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50">
          <div className="mt-0.5">
            <div
              className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[event.status] ?? "bg-gray-400"}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900">{event.message}</p>
            {event.details && Object.keys(event.details).length > 0 && (
              <p className="mt-0.5 truncate text-xs text-gray-400">
                {JSON.stringify(event.details).slice(0, 100)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-xs text-gray-400">{formatRelative(event.created_at)}</div>
        </div>
      ))}

      <div className="mt-4 text-center">
        <Link href="/control-panel/activity" className="text-xs font-medium text-blue-600 hover:text-blue-700">
          View all in Activity Tab →
        </Link>
      </div>
    </div>
  );
}
