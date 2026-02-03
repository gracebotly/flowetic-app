

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const createDeploymentRecord = createTool({
  id: "deploy.createDeploymentRecord",
  description: "Create a deployment record for an interface/version.",
  inputSchema: z.object({
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1),
  }),
  outputSchema: z.object({
    deploymentId: z.string().min(1),
  }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[createDeploymentRecord]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { data, error } = await supabase
      .from("deployments")
      .insert({
        tenant_id: tenantId,
        interface_id: inputData.interfaceId,
        version_id: inputData.previewVersionId,
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { deploymentId: String(data.id) };
  },
});

