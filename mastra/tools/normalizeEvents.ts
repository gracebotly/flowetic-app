

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../lib/supabase";
import { extractTenantContext } from "../lib/tenant-verification";

const PlatformType = z.enum(["vapi", "n8n", "make", "retell"]);

export const normalizeEvents = createTool({
  id: "normalizeEvents",
  description:
    "Normalize raw platform events into Flowetic events rows for Supabase insertion. Adds platform_event_id for idempotency.",
  inputSchema: z.object({
    rawEvents: z.array(z.record(z.any())),
    platformType: PlatformType,
    sourceId: z.string().min(1),
  }),
  outputSchema: z.object({
    normalizedEvents: z.array(z.record(z.any())),
    count: z.number().int(),
  }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[normalizeEvents]: Missing authentication');
    }

    const { tenantId } = extractTenantContext(context);
    const { rawEvents, platformType, sourceId } = inputData;

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
        type: "state",
        name: `${platformType}:${e.workflow_name || e.workflowId || 'workflow'}:execution`,
        text: null,
        state: {
          platformType,
          raw: e,
        },

        // Prefer existing column name 'timestamp' if your table uses it.
        timestamp: ts,
        labels: {
          platformType,
          workflow_id: e.workflow_id || e.workflowId,
          workflow_name: e.workflow_name,
          execution_id: e.execution_id || e.id,
          status: e.status || (e.stoppedAt ? 'error' : 'success'),
        },
      };
    });

    return { normalizedEvents: normalized, count: normalized.length };
  },
});

