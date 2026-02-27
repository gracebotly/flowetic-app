import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";
import { AuthenticatedContextSchema } from "../../lib/REQUEST_CONTEXT_CONTRACT";

export const getRecentEventSamples = createTool({
  id: "getRecentEventSamples",
  description:
    "Fetch recent raw event rows for internal analysis. Returns actual event structure " +
    "including state JSONB (where workflow_id, status, duration_ms live for n8n/Make). " +
    "Filters out internal agent bookkeeping events (state, tool_event types). " +
    "Do not expose raw JSON to user by default.",
  requestContextSchema: AuthenticatedContextSchema,
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
      })
    ),
  }),
  execute: async (inputData, context) => {
    const { sourceId, lastN } = inputData;
    const sampleSize = lastN ?? 100;

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get(
      "supabaseAccessToken"
    ) as string;
    if (!accessToken || typeof accessToken !== "string") {
      throw new Error("[getRecentEventSamples]: Missing authentication token");
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    let query = supabase
      .from("events")
      .select("id, type, name, text, state, labels, timestamp")
      .eq("tenant_id", tenantId)
      // ✅ FIX: Exclude internal agent bookkeeping events
      .not("type", "in", '("state","tool_event")')
      .order("timestamp", { ascending: false })
      .limit(sampleSize);

    // Filter by sourceId if provided
    if (sourceId) {
      query = query.eq("source_id", sourceId);
    }

    // ✅ FIX: Scope to selected workflow
    const selectedWorkflowName = (context?.requestContext as any)?.get('selectedWorkflowName') as string | undefined;
    if (selectedWorkflowName) {
      query = query.eq('state->>workflow_name', selectedWorkflowName);
    }

    const { data: events, error } = await query;

    if (error) {
      throw new Error(`[getRecentEventSamples]: ${error.message}`);
    }

    // ✅ FIX: Map using correct column names (type, not event_type; text, not data.message)
    // and INCLUDE state + labels so agent can see actual event structure
    const samples = (events ?? [])
      .filter((e: any) => e.name !== "thread_event") // Extra safety: filter thread bookkeeping by name
      .map((e: any) => ({
        id: e.id,
        type: e.type || "unknown", // ✅ was: e.event_type (wrong column name)
        name: e.name ?? null,
        text: e.text ?? null, // ✅ was: e.data?.message (wrong path)
        state: e.state ?? null, // ✅ was: undefined (stripped!)
        labels: e.labels ?? null, // ✅ was: undefined (stripped!)
        timestamp: e.timestamp || new Date().toISOString(),
      }));

    return { samples, count: samples.length };
  },
});
