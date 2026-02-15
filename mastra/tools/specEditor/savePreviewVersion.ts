

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistPreviewVersion } from "../persistPreviewVersion";
import { extractTenantContext } from "../../lib/tenant-verification";
import { STYLE_BUNDLE_TOKENS, resolveStyleBundleId } from "../generateUISpec";

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

    // ── Inject default styleBundleId if missing ──────────────────────
    if (!spec_json.styleBundleId) {
      console.warn('[savePreviewVersion] spec_json missing styleBundleId, injecting default');
      spec_json.styleBundleId = 'professional-clean';
    }

    // ── Token-locking guard ──────────────────────────────────────────
    // If spec_json contains a styleBundleId, re-resolve design tokens
    // from the canonical STYLE_BUNDLE_TOKENS map instead of trusting
    // whatever the LLM passed. This prevents hallucinated colors.
    const rawBundleId = spec_json?.styleBundleId;
    if (rawBundleId && typeof rawBundleId === "string") {
      const resolvedId = resolveStyleBundleId(rawBundleId);

      // Re-resolve tokens to catch LLM hallucinations
      if (resolvedId !== rawBundleId) {
        console.warn(
          `[savePreviewVersion] LLM used invalid bundle '${rawBundleId}', corrected to '${resolvedId}'`
        );
        spec_json.styleBundleId = resolvedId;
      }

      const canonicalTokens = STYLE_BUNDLE_TOKENS[resolvedId];
      if (canonicalTokens) {
        console.log(
          `[savePreviewVersion] Token lock: overriding LLM tokens with "${resolvedId}" canonical tokens`
        );
        design_tokens = {
          colors: canonicalTokens.colors,
          fonts: canonicalTokens.fonts,
          spacing: canonicalTokens.spacing,
          radius: canonicalTokens.radius,
          shadow: canonicalTokens.shadow,
        };
      }
    }
    // ── End token-locking guard ──────────────────────────────────────

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
      context
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

