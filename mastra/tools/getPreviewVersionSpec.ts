
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const getPreviewVersionSpec = createTool({
  id: "deploy.getPreviewVersionSpec",
  description: "Fetch spec_json + design_tokens and interface_id for a preview version.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    previewVersionId: z.string().min(1),
  }),
  outputSchema: z.object({
    interfaceId: z.string().min(1),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  execute: async (inputData) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("interface_versions")
      .select("id, interface_id, spec_json, design_tokens")
      .eq("id", inputData.previewVersionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.interface_id) throw new Error("PREVIEW_VERSION_NOT_FOUND");

    return {
      interfaceId: String(data.interface_id),
      spec_json: (data as any).spec_json ?? {},
      design_tokens: (data as any).design_tokens ?? {},
    };
  },
});
