"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SummaryCards } from "@/components/activity/SummaryCards";
import { EventFeed } from "@/components/activity/EventFeed";
import { Loader2, RefreshCw } from "lucide-react";

interface ActivityEvent {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  actor_type: string;
  category: string;
  action: string;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  client_id: string | null;
  offering_id: string | null;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  _color: string;
  _icon: string;
}

interface SummaryData {
  active_clients: number;
  events_today: number;
  success_rate: number;
  revenue_today: number;
  sparkline: { date: string; count: number }[];
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetched = useRef(false);

  // ── Fetch summary ─────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/activity/summary");
      const json = await res.json();
      if (json.ok) {
        setSummary({
          active_clients: json.active_clients,
          events_today: json.events_today,
          success_rate: json.success_rate,
          revenue_today: json.revenue_today,
          sparkline: json.sparkline,
        });
      }
    } catch {
      // Silent fail for summary
    }
  }, []);

  // ── Fetch events (initial or refresh) ─────────────────────
  const fetchEvents = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/api/activity?${params}`);
    const json = await res.json();

    if (!json.ok) return { events: [] as ActivityEvent[], has_more: false };
    return { events: json.events as ActivityEvent[], has_more: json.has_more as boolean };
  }, []);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function load() {
      setLoading(true);
      const [, eventsResult] = await Promise.allSettled([
        fetchSummary(),
        fetchEvents(),
      ]);

      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value.events);
        setHasMore(eventsResult.value.has_more);
      }
      setLoading(false);
    }
    load();
  }, [fetchSummary, fetchEvents]);

  // ── Load more (infinite scroll) ───────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || events.length === 0) return;
    setLoadingMore(true);

    const lastEvent = events[events.length - 1];
    const result = await fetchEvents(lastEvent.created_at);
    setEvents((prev) => [...prev, ...result.events]);
    setHasMore(result.has_more);
    setLoadingMore(false);
  }, [loadingMore, hasMore, events, fetchEvents]);

  // ── Refresh ───────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const [, eventsResult] = await Promise.allSettled([
      fetchSummary(),
      fetchEvents(),
    ]);

    if (eventsResult.status === "fulfilled") {
      setEvents(eventsResult.value.events);
      setHasMore(eventsResult.value.has_more);
    }
    setRefreshing(false);
  }, [fetchSummary, fetchEvents]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Activity"
        subtitle="Monitor everything happening across your workspace."
        rightSlot={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Summary Cards */}
        <SummaryCards data={summary} loading={loading} />

        {/* Event Feed */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <EventFeed
            events={events}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        )}
      </div>
    </div>
  );
}
