import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const markPreviousDeploymentsInactive = createTool({
  id: "deploy.markPreviousDeploymentsInactive",
  description: "Mark all previous deployments inactive except the current one.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    keepDeploymentId: z.string().min(1)
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { error } = await supabase.from("deployments").update({ status: "inactive" }).eq("tenant_id", inputData.tenantId).eq("interface_id", inputData.interfaceId).neq("id", inputData.keepDeploymentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
});

export { markPreviousDeploymentsInactive };
