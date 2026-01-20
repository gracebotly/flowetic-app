


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const appendThreadEvent = createTool({
  id: "appendThreadEvent",
  description:
    "Append a brief rationale event to the thread timeline (stored in events table). Keep message 1-2 sentences.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string(),
    interfaceId: z.string().uuid().optional(),
    runId: z.string().uuid().optional(),
    type: z.enum(["state", "tool_event", "error", "info"]),
    message: z.string().min(1),
    metadata: z.record(z.any()).optional(),
  }),
  outputSchema: z.object({
    eventId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();

    const { tenantId, threadId, interfaceId, runId, type, message, metadata } = inputData;

    const { data, error } = await supabase
      .from("events")
      .insert({
        tenant_id: tenantId,
        interface_id: interfaceId ?? null,
        run_id: runId ?? null,
        type,
        name: "thread_event",
        text: message,
        state: metadata ?? null,
        labels: { threadId },
        timestamp: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return { eventId: data.id };
  },
});



