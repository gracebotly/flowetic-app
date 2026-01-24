

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistPreviewVersion } from "../persistPreviewVersion";

export const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description:
    "Persist a validated spec_json + design_tokens as a new preview interface version. Reads tenantId/userId/interfaceId/platformType from runtimeContext when available.",
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
    // FIXED: Correct parameter destructuring
    const { spec_json, design_tokens, interfaceId } = inputData;

    // FIXED: Use context.get() instead of runtimeContext.get()
    const tenantId = context.get?.("tenantId") as string | undefined;
    const userId = context.get?.("userId") as string | undefined;
    const platformType = (context.get?.("platformType") as string | undefined) ?? "make";

    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");

    const finalInterfaceId =
      interfaceId ?? (context.get?.("interfaceId") as string | undefined) ?? undefined;

    const result = await persistPreviewVersion.execute(
      {
        tenantId,
        userId,
        interfaceId: finalInterfaceId,
        spec_json,
        design_tokens: design_tokens ?? {},
        platformType,
      },  // FIXED: All parameters flat
      context
    );

    return {
      interfaceId: result.interfaceId,
      versionId: result.versionId,
      previewUrl: result.previewUrl,
    };
  },
});

