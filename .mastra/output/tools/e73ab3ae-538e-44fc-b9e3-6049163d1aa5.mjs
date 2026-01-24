import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import { e as encryptSecret } from '../secrets.mjs';
import { SourceStatus, SourceMethod, SourcePlatformType, SourcePublic } from './a7d2415e-1d79-45e7-8be2-cfb9e6e95811.mjs';
import '@supabase/supabase-js';
import 'node:crypto';

const createSource = createTool({
  id: "sources.create",
  description: "Create (connect) a new source for a tenant. Stores credentials in sources.secret_hash (encrypted). Never returns secrets.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    type: SourcePlatformType,
    method: SourceMethod.default("api"),
    name: z.string().min(1).max(120).optional(),
    // Store arbitrary credential payload into secret_hash (encrypted).
    credentials: z.record(z.any()).optional().default({}),
    // Optional override for status on creation; default active.
    status: SourceStatus.optional().default("active")
  }),
  outputSchema: z.object({
    source: SourcePublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const tenantId = inputData.tenantId;
    const type = inputData.type;
    const method = inputData.method;
    const status = inputData.status;
    const name = inputData.name && inputData.name.trim() || `${type} (${method})`;
    const secretPayload = {
      ...inputData.credentials,
      platformType: type,
      method
    };
    const secret_hash = encryptSecret(JSON.stringify(secretPayload));
    const { data, error } = await supabase.from("sources").insert({
      tenant_id: tenantId,
      type,
      name,
      status,
      method,
      secret_hash
    }).select("id, tenant_id, type, name, method, status, created_at").single();
    if (error || !data) throw new Error(`SOURCE_CREATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      source: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        type: SourcePlatformType.parse(String(data.type)),
        name: String(data.name),
        method: SourceMethod.parse(String(data.method ?? "api")),
        status: SourceStatus.parse(String(data.status ?? "active")),
        createdAt: String(data.created_at)
      },
      message: `Connected ${String(data.type)} successfully.`
    };
  }
});

export { createSource };
