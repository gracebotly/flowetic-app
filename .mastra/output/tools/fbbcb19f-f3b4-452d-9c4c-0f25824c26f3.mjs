import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const storeEvents = createTool({
  id: "storeEvents",
  description: "Bulk insert normalized events into Supabase events table. Skips duplicates via (source_id, platform_event_id) unique index.",
  inputSchema: z.object({
    events: z.array(z.record(z.any())),
    tenantId: z.string().min(1),
    sourceId: z.string().min(1)
  }),
  outputSchema: z.object({
    stored: z.number().int(),
    skipped: z.number().int(),
    errors: z.array(z.string())
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const rows = inputData.events ?? [];
    if (!rows.length) return { stored: 0, skipped: 0, errors: [] };
    const { data, error } = await supabase.from("events").upsert(rows, {
      onConflict: "source_id,platform_event_id",
      ignoreDuplicates: true
    }).select("id");
    if (error) {
      return { stored: 0, skipped: 0, errors: [error.message] };
    }
    const stored = (data ?? []).length;
    const skipped = Math.max(0, rows.length - stored);
    return { stored, skipped, errors: [] };
  }
});

export { storeEvents };
