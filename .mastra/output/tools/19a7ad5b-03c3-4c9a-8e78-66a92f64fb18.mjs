import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import { d as decryptSecret, e as encryptSecret } from '../secrets.mjs';
import { SourceStatus, SourceMethod, SourcePlatformType, SourcePublic } from './a7d2415e-1d79-45e7-8be2-cfb9e6e95811.mjs';
import '@supabase/supabase-js';
import 'node:crypto';

const updateSource = createTool({
  id: "sources.update",
  description: "Update an existing source. Supports updating name/status and optionally merging new credential fields into encrypted secret_hash. Never returns secrets.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    status: SourceStatus.optional(),
    // Optional: merge into decrypted secret payload and re-encrypt.
    credentials: z.record(z.any()).optional()
  }),
  outputSchema: z.object({
    source: SourcePublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, sourceId } = inputData;
    const { data: existing, error: exErr } = await supabase.from("sources").select("id, tenant_id, type, name, method, status, secret_hash, created_at").eq("id", sourceId).eq("tenant_id", tenantId).maybeSingle();
    if (exErr) throw new Error(`SOURCE_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("SOURCE_NOT_FOUND");
    const updates = {};
    if (typeof inputData.name === "string") updates.name = inputData.name;
    if (typeof inputData.status === "string") updates.status = inputData.status;
    if (inputData.credentials && typeof inputData.credentials === "object") {
      let prior = {};
      if (existing.secret_hash) {
        try {
          prior = JSON.parse(decryptSecret(String(existing.secret_hash)));
        } catch {
          prior = {};
        }
      }
      const merged = {
        ...prior,
        ...inputData.credentials,
        platformType: String(existing.type ?? "other"),
        method: String(existing.method ?? "api")
      };
      updates.secret_hash = encryptSecret(JSON.stringify(merged));
    }
    if (Object.keys(updates).length === 0) {
      throw new Error("NO_FIELDS_TO_UPDATE");
    }
    const { data, error } = await supabase.from("sources").update(updates).eq("id", sourceId).eq("tenant_id", tenantId).select("id, tenant_id, type, name, method, status, created_at").single();
    if (error || !data) throw new Error(`SOURCE_UPDATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      source: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        type: SourcePlatformType.parse(String(data.type ?? "other")),
        name: String(data.name ?? "connection"),
        method: SourceMethod.parse(String(data.method ?? "api")),
        status: SourceStatus.parse(String(data.status ?? "active")),
        createdAt: String(data.created_at)
      },
      message: "Source updated successfully."
    };
  }
});

export { updateSource };
