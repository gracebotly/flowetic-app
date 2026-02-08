


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const getCurrentSpec = createTool({
  id: "getCurrentSpec",
  description:
    "Fetch latest dashboard UI spec and design tokens for an interface. " +
    "Returns the most recently created version.",
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
    let { interfaceId } = inputData;

    // Fallback to context if not provided
    if (!interfaceId) {
      interfaceId = context?.requestContext?.get("interfaceId") as string | undefined;
    }

    // If still no interfaceId, return empty spec (new dashboard, nothing saved yet)
    if (!interfaceId || interfaceId === "00000000-0000-0000-0000-000000000000") {
      return {
        interfaceId: interfaceId ?? "00000000-0000-0000-0000-000000000000",
        versionId: null,
        spec_json: {},
        design_tokens: {},
      };
    }

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get("supabaseAccessToken") as string;
    if (!accessToken || typeof accessToken !== "string") {
      throw new Error("[getCurrentSpec]: Missing authentication token");
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    // Fetch the most recent version — NO is_preview filter (column doesn't exist)
    const { data: versions, error: versionError } = await supabase
      .from("interface_versions")
      .select("id, spec_json, design_tokens")
      .eq("interface_id", interfaceId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (versionError) throw new Error(versionError.message);

    if (!versions || versions.length === 0) {
      // No versions yet — return empty spec
      return {
        interfaceId,
        versionId: null,
        spec_json: {},
        design_tokens: {},
      };
    }

    return {
      interfaceId,
      versionId: versions[0].id,
      spec_json: versions[0].spec_json,
      design_tokens: versions[0].design_tokens,
    };
  },
});


