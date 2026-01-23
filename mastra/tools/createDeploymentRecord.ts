

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const createDeploymentRecord = createTool({
  id: "deploy.createDeploymentRecord",
  description: "Create a deployment record for an interface/version.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1),
  }),
  outputSchema: z.object({
    deploymentId: z.string().min(1),
  }),
  execute: async (inputData) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("deployments")
      .insert({
        tenant_id: inputData.tenantId,
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

