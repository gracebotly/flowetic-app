

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistPreviewVersion } from "../persistPreviewVersion";
import { extractTenantContext } from "../../lib/tenant-verification";

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
    const { spec_json, design_tokens, interfaceId } = inputData;

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
        design_tokens,
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

