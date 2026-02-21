

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistPreviewVersion } from "../persistPreviewVersion";
import { extractTenantContext } from "../../lib/tenant-verification";
import { STYLE_BUNDLE_TOKENS, resolveStyleBundleId } from "../generateUISpec";
import { InterfaceContextSchema } from "../../lib/REQUEST_CONTEXT_CONTRACT";

/**
 * savePreviewVersion — thin delegate to persistPreviewVersion.
 *
 * This tool is called directly by the dashboardBuilderAgent.
 * It delegates to persistPreviewVersion which handles:
 * - Creating an interface if one doesn't exist
 * - Inserting the version with correct column names
 * - Returning interfaceId, versionId, previewUrl
 */
export const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description:
    "Persist a validated spec_json + design_tokens as a new preview interface version. " +
    "Creates the interface record automatically if interfaceId is not provided.",
  requestContextSchema: InterfaceContextSchema,
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
    const { spec_json, interfaceId } = inputData;
    let { design_tokens } = inputData;

    // ============================================================================
    // DESIGN TOKEN RESOLUTION
    // ============================================================================
    // Priority: custom tokens (styleBundleId === 'custom') > preset tokens
    // Custom tokens are LLM-generated and unique to this workflow.
    if (spec_json.styleBundleId === 'custom' || !STYLE_BUNDLE_TOKENS[spec_json.styleBundleId]) {
      // Custom design system — use tokens as provided, validate minimums
      console.log('[savePreviewVersion] Using custom design tokens (not overwriting)');
      if (!design_tokens?.colors?.primary) {
        console.warn('[savePreviewVersion] Custom tokens missing colors.primary — applying safe defaults');
        design_tokens = {
          ...design_tokens,
          colors: {
            primary: '#2563EB',
            secondary: '#64748B',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            background: '#F8FAFC',
            text: '#0F172A',
            ...design_tokens?.colors,
          },
          fonts: design_tokens?.fonts ?? { heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
          spacing: design_tokens?.spacing ?? { unit: 8 },
          radius: design_tokens?.radius ?? 8,
          shadow: design_tokens?.shadow ?? 'soft',
        };
      }
    } else {
      // Preset fallback — apply canonical tokens (legacy sessions only)
      const resolvedStyleBundleId = resolveStyleBundleId(spec_json.styleBundleId || 'professional-clean');
      const canonical = STYLE_BUNDLE_TOKENS[resolvedStyleBundleId];
      if (canonical) {
        design_tokens = {
          colors: canonical.colors,
          fonts: canonical.fonts,
          spacing: canonical.spacing,
          radius: canonical.radius,
          shadow: canonical.shadow,
        };
        console.log(`[savePreviewVersion] Preset path: "${resolvedStyleBundleId}" tokens`);
      }
    }
    // ============================================================================

    // Get platformType from context for interface naming
    const platformType =
      (context?.requestContext?.get("platformType") as string | undefined) ?? "make";

    // Resolve interfaceId: input > context > undefined (persistPreviewVersion will create one)
    const resolvedInterfaceId =
      interfaceId ??
      (context?.requestContext?.get("interfaceId") as string | undefined) ??
      undefined;

    // Delegate to the canonical persistence tool
    const result = await persistPreviewVersion.execute!(
      {
        interfaceId: resolvedInterfaceId,
        spec_json,
        design_tokens: design_tokens ?? {},
        platformType,
      },
      context as any
    );

    // Handle error case
    if (result instanceof Error) {
      throw result;
    }

    return {
      interfaceId: (result as any).interfaceId,
      versionId: (result as any).versionId,
      previewUrl: (result as any).previewUrl,
    };
  },
});

