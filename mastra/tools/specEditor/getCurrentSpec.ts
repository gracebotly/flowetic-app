
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const getCurrentSpec = createTool({
  id: "getCurrentSpec",
  description:
    "Fetch the latest dashboard UI spec and design tokens for the current interface (dashboard). Uses context?.requestContext?.interfaceId if provided; otherwise finds most recent interface for tenant.",
  inputSchema: z.object({
    interfaceId: z.string().uuid().optional(),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid().nullable(),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {
    const supabase = await createClient();
    const requestContext = context?.requestContext;

    const tenantId = requestContext?.get("tenantId") as string | undefined;
    if (!tenantId) throw new Error("AUTH_REQUIRED");

    const explicitInterfaceId =
      context.interfaceId ??
      (requestContext?.get("interfaceId") as string | undefined);

    let interfaceId: string | undefined = explicitInterfaceId;

    if (!interfaceId) {
      const { data: iface, error: ifaceErr } = await supabase
        .from("interfaces")
        .select("id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ifaceErr) throw new Error(ifaceErr.message);
      interfaceId = iface?.id ?? undefined;
    }

    if (!interfaceId) {
      // No dashboard exists yet — return a safe empty spec skeleton so the agent can proceed.
      // The savePreviewVersion tool will create the interface if needed.
      return {
        interfaceId: (requestContext?.get("interfaceId") as string) || "00000000-0000-0000-0000-000000000000",
        versionId: null,
        spec_json: {
          version: "1.0",
          templateId: "general-analytics",
          platformType: (requestContext?.get("platformType") as string | undefined) ?? "make",
          layout: { type: "grid", columns: 12, gap: 4 },
          components: [],
        },
        design_tokens: {},
      };
    }

    const { data: version, error: versionErr } = await supabase
      .from("interface_versions")
      .select("id,spec_json,design_tokens,created_at")
      .eq("interface_id", interfaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionErr) throw new Error(versionErr.message);

    return {
      interfaceId,
      versionId: version?.id ?? null,
      spec_json: (version?.spec_json as Record<string, any>) ?? {
        version: "1.0",
        templateId: "general-analytics",
        platformType: (requestContext?.get("platformType") as string | undefined) ?? "make",
        layout: { type: "grid", columns: 12, gap: 4 },
        components: [],
      },
      design_tokens: (version?.design_tokens as Record<string, any>) ?? {},
    };
  },
});
