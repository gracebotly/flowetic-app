





import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const setJourneyDeployed = createTool({
  id: "deploy.setJourneyDeployed",
  description:
    "Update journey_sessions preview pointers after deploy (keep current schema).",
  inputSchema: z.object({
    threadId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1),
    deploymentId: z.string().min(1),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[setJourneyDeployed]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { error } = await supabase
      .from("journey_sessions")
      .update({
        preview_interface_id: inputData.interfaceId,
        preview_version_id: inputData.previewVersionId,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("thread_id", inputData.threadId);

    if (error) throw new Error(error.message);
    return { ok: true };
  },
});



