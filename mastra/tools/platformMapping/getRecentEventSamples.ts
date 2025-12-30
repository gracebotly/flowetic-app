


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const getRecentEventSamples = createTool({
  id: "getRecentEventSamples",
  description:
    "Fetch recent raw event rows for internal analysis. Do not expose raw JSON to user by default.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
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
  execute: async ({ context }) => {
    const supabase = await createClient();
    const { tenantId, sourceId, lastN } = context;

    const { data, error } = await supabase
      .from("events")
      .select("id,type,name,text,state,labels,timestamp")
      .eq("tenant_id", tenantId)
      .eq("source_id", sourceId)
      .order("timestamp", { ascending: false })
      .limit(lastN);

    if (error) throw new Error(error.message);

    return { count: (data ?? []).length, samples: data ?? [] };
  },
});



