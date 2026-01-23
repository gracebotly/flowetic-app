




import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const setSchemaReady = createTool({
  id: "journey.setSchemaReady",
  description: "Update journey session schema_ready flag for tenant/thread.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    schemaReady: z.boolean(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("journey_sessions")
      .update({ schema_ready: inputData.schemaReady, updated_at: new Date().toISOString() })
      .eq("tenant_id", inputData.tenantId)
      .eq("thread_id", inputData.threadId);

    if (error) throw new Error(error.message);
    return { ok: true };
  },
});




