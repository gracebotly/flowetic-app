


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const getRecentEventSamples = createTool({
  id: "getRecentEventSamples",
  description: "Fetch recent raw event rows for internal analysis. Do not expose raw JSON to user by default.",
  inputSchema: z.object({
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
    const { sourceId, lastN } = inputData;
    const sampleSize = lastN ?? 100;

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getRecentEventSamples]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("source_id", sourceId)
      .order("timestamp", { ascending: false })
      .limit(sampleSize);

    if (error) throw new Error(error.message);

    const samples = events.map(e => ({
      id: e.id,
      type: e.event_type || 'unknown',
      name: null,
      timestamp: e.timestamp || new Date().toISOString(),
      text: e.data?.message || null,
      state: undefined,
      labels: undefined,
    }));
    return { samples, count: samples.length };
  },
});



