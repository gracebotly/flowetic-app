

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description: "Persist spec_json + design_tokens as a new preview interface_version and return preview URL.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    userId: z.string().min(1),
    interfaceId: z.string().min(1),
    platformType: z.string().min(1),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).optional(),
  }),
  outputSchema: z.object({
    interfaceId: z.string(),
    versionId: z.string(),
    previewUrl: z.string(),
  }),
  execute: async (inputData) => {
    const supabase = createClient();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("interface_versions")
      .insert({
        tenant_id: inputData.tenantId,
        interface_id: inputData.interfaceId,
        spec_json: inputData.spec_json,
        design_tokens: inputData.design_tokens ?? {},
        platform_type: inputData.platformType,
        created_by: inputData.userId,
        created_at: now,
      })
      .select("id, interface_id")
      .single();

    if (error) throw new Error(error.message);

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    return {
      interfaceId: String(data.interface_id),
      versionId: String(data.id),
      previewUrl: `${base}/preview/${encodeURIComponent(String(data.id))}`,
    };
  },
});

