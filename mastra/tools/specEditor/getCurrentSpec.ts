


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";

export const getCurrentSpec = createTool({
  id: "getCurrentSpec",
  description: "Fetch latest dashboard UI spec and design tokens for current interface (dashboard)",
  inputSchema: z.object({
    interfaceId: z.string().uuid().optional(),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid().nullable(),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  execute: async (inputData, context) => {
    const { interfaceId } = inputData;

    const supabase = await createClient();

    const { data: versions, error: versionError } = await supabase
      .from("interface_versions")
      .select("spec_json, design_tokens")
      .eq("interface_id", interfaceId)
      .eq("is_preview", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (versionError) throw new Error(versionError.message);

    if (!versions || versions.length === 0) {
      throw new Error("NO_PREVIEW_VERSION_FOUND");
    }

    const { data: interfaceData, error: interfaceError } = await supabase
      .from("interfaces")
      .select("id, schema_name")
      .eq("id", interfaceId)
      .single();

    if (interfaceError) throw new Error(interfaceError.message);

    return {
      interfaceId,
      versionId: versions[0].id,
      spec_json: versions[0].spec_json,
      design_tokens: versions[0].design_tokens,
      schemaName: interfaceData?.schema_name,
    };
  },
});


