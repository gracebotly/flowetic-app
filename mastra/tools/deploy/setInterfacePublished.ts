


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const setInterfacePublished = createTool({
  id: "deploy.setInterfacePublished",
  description: "Set interfaces.status='published' and active_version_id to the deployed version.",
  inputSchema: z.object({
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[setInterfacePublished]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { error } = await supabase
      .from("interfaces")
      .update({
        status: "published",
        active_version_id: inputData.previewVersionId,
      })
      .eq("tenant_id", tenantId)
      .eq("id", inputData.interfaceId);

    if (error) throw new Error(error.message);
    return { ok: true };
  },
});


