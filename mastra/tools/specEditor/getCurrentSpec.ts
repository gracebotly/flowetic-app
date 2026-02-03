


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

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

    if (!interfaceId) {
      throw new Error("interfaceId is required");
    }

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getCurrentSpec]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { data: versions, error: versionError } = await supabase
      .from("interface_versions")
      .select("id, spec_json, design_tokens")
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
    };
  },
});


