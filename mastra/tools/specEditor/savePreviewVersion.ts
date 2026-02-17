

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
    // PHASE 2: DESIGN TOKEN ENFORCEMENT
    // ============================================================================
    // This guard ensures ALL paths use canonical design tokens from STYLE_BUNDLE_TOKENS.
    // Even if an agent bypasses generateUISpec, we re-apply tokens here as a safety net.
    let resolvedStyleBundleId = spec_json.styleBundleId;
    if (!resolvedStyleBundleId) {
      console.warn(
        '[savePreviewVersion] PHASE 2 WARNING: spec_json missing styleBundleId. ' +
        'Defaulting to "professional-clean". This indicates Path B was used.'
      );
      resolvedStyleBundleId = 'professional-clean';
      spec_json.styleBundleId = resolvedStyleBundleId;
    }

    // Get canonical tokens
    const canonicalTokens = STYLE_BUNDLE_TOKENS[resolvedStyleBundleId];
    if (!canonicalTokens) {
      throw new Error(
        `[savePreviewVersion] Invalid styleBundleId: "${resolvedStyleBundleId}". ` +
        `Must be one of: ${Object.keys(STYLE_BUNDLE_TOKENS).join(', ')}`
      );
    }

    // Detect hallucinated colors
    const llmColors = spec_json.theme?.colors;
    const canonicalColors = canonicalTokens.colors;
    if (llmColors && canonicalColors) {
      const llmColorKeys = Object.keys(llmColors).sort();
      const canonicalColorKeys = Object.keys(canonicalColors).sort();
      const keysMatch = llmColorKeys.join(',') === canonicalColorKeys.join(',');

      if (!keysMatch) {
        console.warn(
          '[savePreviewVersion] PHASE 2 WARNING: LLM hallucinated colors. ' +
          `Expected keys: [${canonicalColorKeys.join(', ')}], ` +
          `Got: [${llmColorKeys.join(', ')}]`
        );
      }
    }

    // Override with canonical tokens (the actual enforcement)
    design_tokens = {
      colors: canonicalTokens.colors,
      fonts: canonicalTokens.fonts,
      spacing: canonicalTokens.spacing,
      radius: canonicalTokens.radius,
      shadow: canonicalTokens.shadow,
    };

    console.log(
      `[savePreviewVersion] Token lock: overriding with "${resolvedStyleBundleId}" canonical tokens`
    );
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

