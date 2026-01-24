import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import '@supabase/supabase-js';

const getCurrentSpec = createTool({
  id: "getCurrentSpec",
  description: "Fetch the latest dashboard UI spec and design tokens for the current interface (dashboard). Uses runtimeContext.interfaceId if provided; otherwise finds most recent interface for tenant.",
  inputSchema: z.object({
    interfaceId: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid().nullable(),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any())
  }),
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();
    const tenantId = runtimeContext?.get("tenantId");
    if (!tenantId) throw new Error("AUTH_REQUIRED");
    const explicitInterfaceId = inputData.interfaceId ?? runtimeContext?.get("interfaceId");
    let interfaceId = explicitInterfaceId;
    if (!interfaceId) {
      const { data: iface, error: ifaceErr } = await supabase.from("interfaces").select("id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (ifaceErr) throw new Error(ifaceErr.message);
      interfaceId = iface?.id ?? void 0;
    }
    if (!interfaceId) {
      return {
        interfaceId: runtimeContext?.get("interfaceId") || "00000000-0000-0000-0000-000000000000",
        versionId: null,
        spec_json: {
          version: "1.0",
          templateId: "general-analytics",
          platformType: runtimeContext?.get("platformType") ?? "make",
          layout: { type: "grid", columns: 12, gap: 4 },
          components: []
        },
        design_tokens: {}
      };
    }
    const { data: version, error: versionErr } = await supabase.from("interface_versions").select("id,spec_json,design_tokens,created_at").eq("interface_id", interfaceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (versionErr) throw new Error(versionErr.message);
    return {
      interfaceId,
      versionId: version?.id ?? null,
      spec_json: version?.spec_json ?? {
        version: "1.0",
        templateId: "general-analytics",
        platformType: runtimeContext?.get("platformType") ?? "make",
        layout: { type: "grid", columns: 12, gap: 4 },
        components: []
      },
      design_tokens: version?.design_tokens ?? {}
    };
  }
});

export { getCurrentSpec };
