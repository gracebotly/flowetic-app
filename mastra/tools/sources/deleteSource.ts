


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const deleteSource = createTool({
  id: "sources.delete",
  description: "Delete (disconnect) a source by ID for a tenant.",
  inputSchema: z.object({
    sourceId: z.string().uuid(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[deleteSource]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);
    const { sourceId } = inputData;

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


