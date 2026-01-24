import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const setInterfacePublished = createTool({
  id: "deploy.setInterfacePublished",
  description: "Set interfaces.status='published' and active_version_id to the deployed version.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1)
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { error } = await supabase.from("interfaces").update({
      status: "published",
      active_version_id: inputData.previewVersionId
    }).eq("tenant_id", inputData.tenantId).eq("id", inputData.interfaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
});

export { setInterfacePublished };
