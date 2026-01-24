

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistPreviewVersion } from "../persistPreviewVersion";

export const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description:
    "Persist a validated spec_json + design_tokens as a new preview interface version. Reads tenantId/userId/interfaceId/platformType from runtimeContext when available.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).default({}),
    interfaceId: z.string().uuid().optional(),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  execute: async (inputData, context) => {
    const { spec_json, design_tokens, interfaceId } = inputData;

    const supabase = await createClient();

    // Get tenantId and userId from request context, not from context.get()
    const requestContext = (context as any).requestContext;
    const tenantId = requestContext?.get("tenantId") as string | undefined;
    const userId = requestContext?.get("userId") as string | undefined;
    const platformType = (requestContext?.get("platformType") as string | undefined) ?? "make";

    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");

    const finalInterfaceId = interfaceId ?? (requestContext?.get("interfaceId") as string | undefined) ?? undefined;

    const { data: version, error: versionError } = await supabase
      .from("interface_versions")
      .insert({
        interface_id: finalInterfaceId,
        tenant_id: tenantId,
        user_id: userId,
        spec_json,
        design_tokens: design_tokens ?? {},
        is_preview: true,
        created_at: new Date().toISOString(),
      })
      .select("id, interface_id, preview_url")
      .single();

    if (versionError) throw new Error(versionError.message);

    const previewUrl = version?.preview_url ?? `https://flowetic.com/preview/${version.id}`;

    return {
      interfaceId: finalInterfaceId ?? version.interface_id,
      versionId: version.id,
      previewUrl,
    };
  },
});

