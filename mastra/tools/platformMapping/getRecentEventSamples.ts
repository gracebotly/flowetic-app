


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const getRecentEventSamples = createTool({
  id: "getRecentEventSamples",
  description: "Fetch recent raw event rows for internal analysis. Do not expose raw JSON to user by default.",
  inputSchema: z.object({
    tenantId: z.string().uuid().optional(),
    sourceId: z.string().uuid().optional(),
    lastN: z.number().int().min(1).max(500).default(100),
  }),
  outputSchema: z.object({
    count: z.number().int(),
    samples: z.array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        name: z.string().nullable(),
        text: z.string().nullable(),
        state: z.any().nullable(),
        labels: z.any().nullable(),
        timestamp: z.string(),
      }),
    ),
  }),
  execute: async (inputData, context) => {
    const { tenantId, sourceId, lastN } = inputData;
    const sampleSize = lastN ?? 100;

    const supabase = await createClient();

    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("source_id", sourceId)
      .order("timestamp", { ascending: false })
      .limit(sampleSize);

    if (error) throw new Error(error.message);

    return { events, count: events.length };
  },
});



