// mastra/tools/normalizeEvents.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractTenantContext } from '../lib/tenant-verification';
import { getNormalizer } from '../normalizers';
import { AuthenticatedContextSchema } from '../lib/REQUEST_CONTEXT_CONTRACT';

const PlatformType = z.enum(['vapi', 'n8n', 'make', 'retell']);

export const normalizeEvents = createTool({
  id: 'normalizeEvents',
  description:
    'Normalize raw platform events into Flowetic events rows for Supabase insertion. ' +
    'Uses platform-specific normalizers to extract structured fields into state. ' +
    'Adds platform_event_id for idempotency.',
  requestContextSchema: AuthenticatedContextSchema,
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
    // Auth
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[normalizeEvents]: Missing authentication');
    }

    const { tenantId } = extractTenantContext(context);
    const { rawEvents, platformType, sourceId } = inputData;

    // Get platform-specific normalizer (falls back to generic)
    const normalizer = getNormalizer(platformType);

    const normalized = (rawEvents ?? []).map((e: Record<string, unknown>, idx: number) => {
      // Extract a stable platform event ID for idempotency
      const platformEventId = String(
        e?.id ??
        e?.eventId ??
        e?.executionId ??
        e?.callId ??
        (e?.labels && typeof e.labels === 'object'
          ? (e.labels as Record<string, unknown>).execution_id ??
            (e.labels as Record<string, unknown>).call_id
          : undefined) ??
        `${platformType}-${idx}`
      );

      // Best-effort timestamp
      const ts = String(
        e?.timestamp ??
        e?.occurred_at ??
        e?.created_at ??
        e?.startedAt ??
        e?.ended_at ??
        new Date().toISOString()
      );

      // Run platform-specific normalization
      const extracted = normalizer.normalize(e);

      // Override the generic platform name with the actual platformType
      extracted.state.platform = platformType;
      extracted.labels.platformType = platformType;

      return {
        tenant_id: tenantId,
        source_id: sourceId,
        platform_event_id: platformEventId,
        type: extracted.type ?? e?.type ?? e?.event_type ?? e?.eventType ?? e?.category ?? 'unknown',
        name: extracted.name,
        text: null,
        state: extracted.state,
        timestamp: ts,
        labels: extracted.labels,
      };
    });

    // Validate that all events have valid types
    const valid = normalized.filter((e: Record<string, unknown>) =>
      e.type && e.type !== 'unknown' && e.type !== 'undefined'
    );
    const invalid = normalized.filter((e: Record<string, unknown>) =>
      !e.type || e.type === 'unknown' || e.type === 'undefined'
    );

    if (invalid.length > 0) {
      console.warn(
        `[normalizeEvents] ${invalid.length} events have undefined/unknown type`,
        {
          platformType,
          sampleKeys: Object.keys(rawEvents[0] ?? {}).slice(0, 10),
          sampleInvalidEvent: invalid[0]
        }
      );
    }

    return { normalizedEvents: valid, count: valid.length };
  },
});
