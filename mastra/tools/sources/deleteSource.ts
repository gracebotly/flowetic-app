


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const deleteSource = createTool({
  id: "sources.delete",
  description: "Delete (disconnect) a source by ID for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData: any, context: any) => {
    const supabase = await createClient();
    const { tenantId, sourceId } = inputData;

    // Pre-check so we can return SOURCE_NOT_FOUND deterministically.
    const { data: existing, error: exErr } = await supabase
      .from("sources")
      .select("id")
      .eq("id", sourceId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (exErr) throw new Error(`SOURCE_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("SOURCE_NOT_FOUND");

    const { error } = await supabase
      .from("sources")
      .delete()
      .eq("id", sourceId)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`SOURCE_DELETE_FAILED: ${error.message}`);

    return { success: true, message: "Source deleted successfully." };
  },
});


