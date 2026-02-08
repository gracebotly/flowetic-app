
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const getPreviewVersionSpec = createTool({
  id: "deploy.getPreviewVersionSpec",
  description: "Fetch spec_json + design_tokens and interface_id for a preview version.",
  inputSchema: z.object({
    previewVersionId: z.string().min(1),
  }),
  outputSchema: z.object({
    interfaceId: z.string().min(1),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  execute: async (inputData, context) => {
    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[getPreviewVersionSpec]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { data, error } = await supabase
      .from("interface_versions")
      .select("id, interface_id, spec_json, design_tokens")
      .eq("id", inputData.previewVersionId)
      // tenant_id column does not exist on interface_versions — RLS handles tenant scoping
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
