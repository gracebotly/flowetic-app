


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { SourceMethod, SourcePlatformType, SourcePublic, SourceStatus } from "./types";

export const updateSource = createTool({
  id: "sources.update",
  description:
    "Update an existing source. Supports updating name/status and optionally merging new credential fields into encrypted secret_hash. Never returns secrets.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    status: SourceStatus.optional(),
    // Optional: merge into decrypted secret payload and re-encrypt.
    credentials: z.record(z.any()).optional(),
  }),
  outputSchema: z.object({
    source: SourcePublic,
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {
    const supabase = await createClient();
    const { tenantId, sourceId } = inputData;

    const { data: existing, error: exErr } = await supabase
      .from("sources")
      .select("id, tenant_id, type, name, method, status, secret_hash, created_at")
      .eq("id", sourceId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (exErr) throw new Error(`SOURCE_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("SOURCE_NOT_FOUND");

    const updates: Record<string, any> = {};
    if (typeof context.name === "string") updates.name = context.name;
    if (typeof context.status === "string") updates.status = context.status;

    if (context.credentials && typeof context.credentials === "object") {
      let prior: any = {};
      if (existing.secret_hash) {
        try {
          prior = JSON.parse(decryptSecret(String(existing.secret_hash)));
        } catch {
          prior = {};
        }
      }
      const merged = {
        ...prior,
        ...context.credentials,
        platformType: String(existing.type ?? "other"),
        method: String(existing.method ?? "api"),
      };
      updates.secret_hash = encryptSecret(JSON.stringify(merged));
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("NO_FIELDS_TO_UPDATE");
    }

    const { data, error } = await supabase
      .from("sources")
      .update(updates)
      .eq("id", sourceId)
      .eq("tenant_id", tenantId)
      .select("id, tenant_id, type, name, method, status, created_at")
      .single();

    if (error || !data) throw new Error(`SOURCE_UPDATE_FAILED: ${error?.message ?? "NO_DATA"}`);

    return {
      source: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        type: SourcePlatformType.parse(String(data.type ?? "other")),
        name: String(data.name ?? "connection"),
        method: SourceMethod.parse(String(data.method ?? "api")),
        status: SourceStatus.parse(String(data.status ?? "active")),
        createdAt: String(data.created_at),
      },
      message: "Source updated successfully.",
    };
  },
});



