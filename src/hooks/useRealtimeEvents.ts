"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const MAX_EVENTS = 1000;
const DEBOUNCE_MS = 250;
const STALE_TIMEOUT_MS = 30_000; // 30s without heartbeat = stale

type ConnectionStatus = "connecting" | "connected" | "stale" | "error";

interface UseRealtimeEventsOptions {
  sourceId: string;
  interfaceId: string;
  initialEvents: any[];
  enabled?: boolean;
}

interface UseRealtimeEventsReturn {
  events: any[];
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  newEventCount: number;
  resetCount: () => void;
}

export function useRealtimeEvents({
  sourceId,
  interfaceId,
  initialEvents,
  enabled = true,
}: UseRealtimeEventsOptions): UseRealtimeEventsReturn {
  const [events, setEvents] = useState<any[]>(initialEvents);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const newEventCountRef = useRef(0);
  const [newEventCount, setNewEventCount] = useState(0);

  // Dedupe: track seen event IDs
  const seenIdsRef = useRef<Set<string>>(
    new Set(initialEvents.map((e) => e.id).filter(Boolean))
  );

  // Stale detection
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeartbeatRef = useRef<number>(0);

  // Batching
  const pendingEventsRef = useRef<any[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCount = useCallback(() => {
    newEventCountRef.current = 0;
    setNewEventCount(0);
  }, []);

  const resetStaleTimer = useCallback(() => {
    lastHeartbeatRef.current = Date.now();
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    staleTimerRef.current = setTimeout(() => {
      setConnectionStatus((prev) => (prev === "connected" ? "stale" : prev));
    }, STALE_TIMEOUT_MS);
  }, []);

  const flushPending = useCallback(() => {
    if (pendingEventsRef.current.length === 0) return;

    const batch = [...pendingEventsRef.current];
    pendingEventsRef.current = [];

    // Deduplicate against seen IDs
    const novel = batch.filter((evt) => {
      const id = evt.id;
      if (!id || seenIdsRef.current.has(id)) return false;
      seenIdsRef.current.add(id);
      return true;
    });

    if (novel.length === 0) return;

    setEvents((prev) => [...novel, ...prev].slice(0, MAX_EVENTS));

    newEventCountRef.current += novel.length;
    setNewEventCount(newEventCountRef.current);

    // Each flush = proof of life
    resetStaleTimer();
  }, [resetStaleTimer]);

  useEffect(() => {
    if (!enabled || !sourceId) {
      setConnectionStatus("error");
      return;
    }

    setConnectionStatus("connecting");

    const supabase = createClient();
    const channel: RealtimeChannel = supabase
      .channel(`preview:${interfaceId}`, {
        config: { presence: { key: interfaceId } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `source_id=eq.${sourceId}`,
        },
        (payload) => {
          pendingEventsRef.current.push(payload.new);

          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(flushPending, DEBOUNCE_MS);
        }
      )
      .subscribe((status, err) => {
        console.log(`[Realtime] preview:${interfaceId} → ${status}`, err ?? "");

        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          setConnectionError(null);
          resetStaleTimer();
        } else if (status === "CLOSED") {
          setConnectionStatus("error");
          setConnectionError("Channel closed");
        } else if (status === "CHANNEL_ERROR") {
          setConnectionStatus("error");
          setConnectionError(err?.message ?? "Channel error — check auth");
        } else if (status === "TIMED_OUT") {
          setConnectionStatus("error");
          setConnectionError("Connection timed out");
        }
      });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
      console.log(`[Realtime] Cleaned up channel preview:${interfaceId}`);
    };
  }, [sourceId, interfaceId, enabled, flushPending, resetStaleTimer]);

  return { events, connectionStatus, connectionError, newEventCount, resetCount };
}
