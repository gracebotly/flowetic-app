

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

    // ── Validation Gate: Reject specs without valid styleBundleId ──────
    // This prevents the LLM from bypassing generateUISpec and inventing colors
    const rawBundleId = spec_json?.styleBundleId;

    if (!rawBundleId || typeof rawBundleId !== "string") {
      const errorMsg =
        "[savePreviewVersion] REJECTED: spec_json missing styleBundleId. " +
        "Specs must be generated via generateUISpec tool to ensure deterministic design tokens. " +
        "LLM attempted to bypass design token enforcement.";
      console.error(errorMsg);
      throw new Error(
        "INVALID_SPEC: Missing styleBundleId. Use generateUISpec tool to create specs with proper design tokens."
      );
    }

    const resolvedBundleId = resolveStyleBundleId(rawBundleId);
    if (!STYLE_BUNDLE_TOKENS[resolvedBundleId]) {
      const errorMsg =
        `[savePreviewVersion] REJECTED: Invalid styleBundleId "${rawBundleId}" (resolved to "${resolvedBundleId}"). ` +
        `Valid bundles: ${Object.keys(STYLE_BUNDLE_TOKENS).join(', ')}. ` +
        "Use generateUISpec tool with a valid style bundle.";
      console.error(errorMsg);
      throw new Error(
        `INVALID_STYLE_BUNDLE: "${rawBundleId}" is not a valid style bundle. Use generateUISpec tool.`
      );
    }

    console.log(
      `[savePreviewVersion] ✓ Validation passed: styleBundleId="${resolvedBundleId}" (from input: "${rawBundleId}")`
    );

    // ── Token-locking guard ──────────────────────────────────────────
    // Override LLM-provided tokens with canonical tokens from STYLE_BUNDLE_TOKENS
    const canonicalTokens = STYLE_BUNDLE_TOKENS[resolvedBundleId];
    if (canonicalTokens) {
      console.log(
        `[savePreviewVersion] Token lock: overriding LLM tokens with "${resolvedBundleId}" canonical tokens`
      );
      design_tokens = {
        colors: canonicalTokens.colors,
        fonts: canonicalTokens.fonts,
        spacing: canonicalTokens.spacing,
        radius: canonicalTokens.radius,
        shadow: canonicalTokens.shadow,
      };
    }

    // Update spec_json with resolved bundle ID if it was different
    if (resolvedBundleId !== rawBundleId) {
      console.warn(
        `[savePreviewVersion] Correcting styleBundleId: '${rawBundleId}' → '${resolvedBundleId}'`
      );
      spec_json.styleBundleId = resolvedBundleId;
    }
    // ── End validation gate and token-locking ──────────────────────────

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

