


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
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();

    const tenantId =
      inputData.tenantId ??
      (runtimeContext?.get("tenantId") as string | undefined) ??
      undefined;

    const sourceId =
      inputData.sourceId ??
      (runtimeContext?.get("sourceId") as string | undefined) ??
      undefined;

    if (!tenantId) throw new Error("AUTH_REQUIRED");
    if (!sourceId) throw new Error("CONNECTION_NOT_CONFIGURED");

    const { data, error } = await supabase
      .from("events")
      .select("id,type,name,text,state,labels,timestamp")
      .eq("tenant_id", tenantId)
      .eq("source_id", sourceId)
      .order("timestamp", { ascending: false })
      .limit(inputData.lastN);

    if (error) throw new Error(error.message);

    return { count: (data ?? []).length, samples: data ?? [] };
  },
});



