

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

    // Attempt upsert-like behavior by inserting and ignoring conflicts via unique index.
    // Supabase JS upsert requires specifying conflict columns. We'll use upsert on (source_id, platform_event_id).
    // If platform_event_id is null, it's not eligible for the unique partial index; that's acceptable.
    const { data, error } = await supabase
      .from("events")
      .upsert(rows, {
        onConflict: "source_id,platform_event_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      return { stored: 0, skipped: 0, errors: [error.message] };
    }

    const stored = (data ?? []).length;
    const skipped = Math.max(0, rows.length - stored);

    return { stored, skipped, errors: [] };
  },
});

