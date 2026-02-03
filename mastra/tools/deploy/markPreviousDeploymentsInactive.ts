


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const markPreviousDeploymentsInactive = createTool({
  id: "deploy.markPreviousDeploymentsInactive",
  description: "Mark all previous deployments inactive except the current one.",
  inputSchema: z.object({
    interfaceId: z.string().min(1),
    keepDeploymentId: z.string().min(1),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[markPreviousDeploymentsInactive]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { error } = await supabase
      .from("deployments")
      .update({ status: "inactive" })
      .eq("tenant_id", tenantId)
      .eq("interface_id", inputData.interfaceId)
      .neq("id", inputData.keepDeploymentId);

    if (error) throw new Error(error.message);
    return { ok: true };
  },
});


