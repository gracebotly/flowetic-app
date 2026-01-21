

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { persistPreviewVersion } from "../persistPreviewVersion";
import { callTool } from "../../lib/callTool";

export const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description:
    "Persist a validated spec_json + design_tokens as a new preview interface version. Reads tenantId/userId/interfaceId/platformType from requestContext when available.",
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
  execute: async (inputData: any, context: any) => {
    const tenantId =
      inputData.runtimeContext?.tenantId ??
      (context?.runtimeContext?.get("tenantId") as string | undefined);
    const userId = inputData.runtimeContext?.userId ?? (context?.runtimeContext?.get("userId") as string | undefined);
    const platformType = inputData.runtimeContext?.platformType ?? (context?.runtimeContext?.get("platformType") as string | undefined) ?? "make";

    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");

    const interfaceId =
      inputData.interfaceId ??
      inputData.interfaceId ??
      inputData.runtimeContext?.interfaceId ??
      (context?.runtimeContext?.get("interfaceId") as string | undefined) ??
      undefined;

    const result = await callTool(
      persistPreviewVersion,
      {
        tenantId,
        userId,
        interfaceId,
        spec_json: inputData.spec_json,
        design_tokens: inputData.design_tokens ?? {},
        platformType,
      },
      { runtimeContext: context?.runtimeContext ?? context ?? {} }
    );

    return {
      interfaceId: result.interfaceId,
      versionId: result.versionId,
      previewUrl: result.previewUrl,
    };
  },
});

