

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const PlatformType = z.enum(["vapi", "n8n", "make", "retell"]);

export const normalizeEvents = createTool({
  id: "normalizeEvents",
  description:
    "Normalize raw platform events into Flowetic events rows for Supabase insertion. Adds platform_event_id for idempotency.",
  inputSchema: z.object({
    rawEvents: z.array(z.any()),
    platformType: PlatformType,
    sourceId: z.string().min(1),
    tenantId: z.string().min(1),
  }),
  outputSchema: z.object({
    normalizedEvents: z.array(z.record(z.any())),
    count: z.number().int(),
  }),
  execute: async (inputData) => {
    const { rawEvents, platformType, sourceId, tenantId } = inputData;

    // IMPORTANT:
    // We normalize into the existing 'events' table schema used in this repo.
    // Keep it minimal: tenant_id, source_id, type, name, text/state/timestamp + platform_event_id.
    // If raw events are empty, return empty.
    const normalized = (rawEvents ?? []).map((e: any, idx: number) => {
      const platformEventId =
        String(e?.id ?? e?.eventId ?? e?.executionId ?? e?.callId ?? `${platformType}-${idx}`);

      const ts =
        e?.timestamp ??
        e?.occurred_at ??
        e?.created_at ??
        e?.ended_at ??
        new Date().toISOString();

      return {
        tenant_id: tenantId,
        source_id: sourceId,
        platform_event_id: platformEventId,

        // Minimal classification
        type: "platform_event",
        name: `${platformType}.event`,
        text: null,
        state: {
          platformType,
          raw: e,
        },

        // Prefer existing column name 'timestamp' if your table uses it.
        timestamp: ts,
        labels: { platformType },
      };
    });

    return { normalizedEvents: normalized, count: normalized.length };
  },
});

