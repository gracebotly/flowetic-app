

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
  execute: async ({ context, runtimeContext }) => {
    const tenantId = runtimeContext?.get("tenantId") as string | undefined;
    const userId = runtimeContext?.get("userId") as string | undefined;
    const platformType = (runtimeContext?.get("platformType") as string | undefined) ?? "other";

    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");

    const interfaceId =
      context.interfaceId ??
      (runtimeContext?.get("interfaceId") as string | undefined) ??
      undefined;

    const result = await persistPreviewVersion.execute({
      context: {
        tenantId,
        userId,
        interfaceId,
        spec_json: context.spec_json,
        design_tokens: context.design_tokens ?? {},
        platformType,
      },
      runtimeContext,
    });

    return {
      interfaceId: result.interfaceId,
      versionId: result.versionId,
      previewUrl: result.previewUrl,
    };
  },
});

