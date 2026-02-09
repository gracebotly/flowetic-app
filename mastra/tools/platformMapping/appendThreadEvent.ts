


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const appendThreadEvent = createTool({
  id: "appendThreadEvent",
  description:
    "Append a brief rationale event to the thread timeline (stored in events table). Keep message 1-2 sentences.",
  inputSchema: z.object({
    threadId: z.string(),
    interfaceId: z.string().uuid().optional(),
    sourceId: z.string().uuid().optional().describe("Source ID for the event (required if metadata.sourceId not provided)"),
    runId: z.string().uuid().optional(),
    type: z.enum(["state", "tool_event", "error"]),
    message: z.string().min(1),
    metadata: z.record(z.any()).optional(),
    // NEW: Support for action buttons
    actionButton: z.object({
      label: z.string(),
      action: z.enum(["start_backfill", "generate_preview", "retry"]),
      payload: z.record(z.any()).optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    eventId: z.string().uuid(),
    actionButton: z.object({
      label: z.string(),
      action: z.string(),
      payload: z.record(z.any()).optional(),
    }).nullable(),
  }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[appendThreadEvent]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { threadId, interfaceId, sourceId: directSourceId, runId, type, message, metadata, actionButton } = inputData;

    // ✅ FIX: Fall back to RequestContext sourceId if not provided (same pattern as getEventStats)
    const sourceId = directSourceId 
      ?? (metadata?.sourceId as string | undefined)
      ?? (context?.requestContext?.get('sourceId') as string | undefined);
    
    if (!sourceId) {
      throw new Error('[appendThreadEvent]: sourceId missing — not in args, metadata, or RequestContext');
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        tenant_id: tenantId,
        interface_id: interfaceId ?? null,
        source_id: sourceId ?? null,
        run_id: runId ?? null,
        type,
        name: "thread_event",
        text: message,
        state: metadata ?? null,
        // Store actionButton in labels if provided
        labels: {
          threadId,
          ...(actionButton ? { actionButton } : {}),
        },
        timestamp: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return {
      eventId: data.id,
      actionButton: actionButton ?? null,
    };
  },
});



