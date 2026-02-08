

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../lib/supabase";
import { extractTenantContext } from "../lib/tenant-verification";

export const storeEvents = createTool({
  id: "storeEvents",
  description:
    "Bulk insert normalized events into Supabase events table. Skips duplicates via (source_id, platform_event_id) unique index.",
  inputSchema: z.object({
    events: z.array(z.record(z.any())),
    sourceId: z.string().min(1),
  }),
  outputSchema: z.object({
    stored: z.number().int(),
    skipped: z.number().int(),
    errors: z.array(z.string()),
  }),
  execute: async (inputData, context) => {
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[storeEvents]: Missing authentication');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);
    const rows = inputData.events ?? [];

    if (!rows.length) return { stored: 0, skipped: 0, errors: [] };

    // Strip platform_event_id from rows to build clean rows for fallback
    const cleanRows = rows.map((r: Record<string, unknown>) => {
      const { platform_event_id, ...rest } = r;
      return rest;
    });

    // Try upsert with platform_event_id first (preferred: dedup support)
    const hasPlatformIds = rows.every(
      (r: Record<string, unknown>) =>
        r.platform_event_id != null && r.platform_event_id !== ""
    );

    let data: { id: string }[] | null = null;
    let count: number | null = null;

    if (hasPlatformIds) {
      try {
        const result = await supabase
          .from("events")
          .upsert(rows, {
            onConflict: "source_id,platform_event_id",
            ignoreDuplicates: true,
          })
          .select("id", { count: "exact" })
          .throwOnError();

        data = result.data;
        count = result.count;
      } catch (err: any) {
        if (err?.message?.includes("platform_event_id")) {
          // Column doesn't exist yet — fall back to plain insert without that field
          console.warn("[storeEvents] platform_event_id column missing, falling back to insert");
          const fallback = await supabase
            .from("events")
            .insert(cleanRows)
            .select("id", { count: "exact" })
            .throwOnError();

          data = fallback.data;
          count = fallback.count;
        } else {
          console.error("[storeEvents] INSERT failed:", err.code, err.message);
          throw new Error(`storeEvents INSERT failed: ${err.code} — ${err.message}`);
        }
      }
    } else {
      const result = await supabase
        .from("events")
        .insert(cleanRows)
        .select("id", { count: "exact" })
        .throwOnError();

      data = result.data;
      count = result.count;
    }

    const stored = count ?? data?.length ?? 0;
    const skipped = Math.max(0, rows.length - stored);

    console.log(`[storeEvents] Stored ${stored} events, skipped ${skipped}`);

    return { stored, skipped, errors: [] };
  },
});

