

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import { encryptSecret } from "@/lib/secrets";
import { SourceMethod, SourcePlatformType, SourcePublic, SourceStatus } from "./types";

export const createSource = createTool({
  id: "sources.create",
  description:
    "Create (connect) a new source for a tenant. Stores credentials in sources.secret_hash (encrypted). Never returns secrets.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    type: SourcePlatformType,
    method: SourceMethod.default("api"),
    name: z.string().min(1).max(120).optional(),
    // Store arbitrary credential payload into secret_hash (encrypted).
    credentials: z.record(z.any()).optional().default({}),
    // Optional override for status on creation; default active.
    status: SourceStatus.optional().default("active"),
  }),
  outputSchema: z.object({
    source: SourcePublic,
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();

    const tenantId = inputData.tenantId;
    const type = inputData.type;
    const method = inputData.method;
    const status = inputData.status;

    const name =
      (inputData.name && inputData.name.trim()) || `${type} (${method})`;

    // Keep a tiny amount of metadata in secret to help later debugging/rotation.
    const secretPayload = {
      ...inputData.credentials,
      platformType: type,
      method,
    };

    const secret_hash = encryptSecret(JSON.stringify(secretPayload));

    const { data, error } = await supabase
      .from("sources")
      .insert({
        tenant_id: tenantId,
        type,
        name,
        status,
        method,
        secret_hash,
      })
      .select("id, tenant_id, type, name, method, status, created_at")
      .single();

    if (error || !data) throw new Error(`SOURCE_CREATE_FAILED: ${error?.message ?? "NO_DATA"}`);

    return {
      source: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        type: SourcePlatformType.parse(String(data.type)),
        name: String(data.name),
        method: SourceMethod.parse(String(data.method ?? "api")),
        status: SourceStatus.parse(String(data.status ?? "active")),
        createdAt: String(data.created_at),
      },
      message: `Connected ${String(data.type)} successfully.`,
    };
  },
});

