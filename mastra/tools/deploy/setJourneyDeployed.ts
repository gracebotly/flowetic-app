





import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const setJourneyDeployed = createTool({
  id: "deploy.setJourneyDeployed",
  description:
    "Update journey_sessions preview pointers after deploy (keep current schema).",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("journey_sessions")
      .update({
        preview_interface_id: inputData.interfaceId,
        preview_version_id: inputData.previewVersionId,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", inputData.tenantId)
      .eq("thread_id", inputData.threadId);

    if (error) throw new Error(error.message);
    return { ok: true };
  },
});



