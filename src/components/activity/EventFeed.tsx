"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { EventRow } from "@/components/activity/EventRow";

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

interface EventFeedProps {
  events: ActivityEvent[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

export function EventFeed({
  events,
  hasMore,
  loadingMore,
  onLoadMore,
  selectedEventId,
  onSelectEvent,
}: EventFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Infinite scroll via IntersectionObserver ───────────────
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
        onLoadMore();
      }
    },
    [hasMore, loadingMore, onLoadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px",
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [handleIntersect]);

  // ── Empty state ───────────────────────────────────────────
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <ClipboardList className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-gray-900">
          No activity yet
        </h3>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Events will appear here as you connect platforms, add clients, create
          client portals, and run workflows.
        </p>
      </div>
    );
  }

  // ── Event list ────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Event Stream</h2>
      </div>

      <div className="divide-y divide-gray-50">
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            isSelected={event.id === selectedEventId}
            onClick={() => onSelectEvent(event.id)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="flex justify-center border-t border-gray-50 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}

      {/* End of list */}
      {!hasMore && events.length > 0 && (
        <div className="border-t border-gray-50 py-3 text-center">
          <p className="text-xs text-gray-400">
            End of activity — showing last {events.length} events
          </p>
        </div>
      )}
    </div>
  );
}
