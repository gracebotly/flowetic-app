

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
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {
    const requestContext = context?.requestContext;
    const tenantId = requestContext?.get("tenantId") as string | undefined;
    const userId = requestContext?.get("userId") as string | undefined;
    const platformType = (requestContext?.get("platformType") as string | undefined) ?? "make";

    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");

    const interfaceId =
      context.interfaceId ??
      (requestContext?.get("interfaceId") as string | undefined) ??
      undefined;

    const result = await callTool(
      persistPreviewVersion,
      {
        tenantId,
        userId,
        interfaceId,
        spec_json: context.spec_json,
        design_tokens: context.design_tokens ?? {},
        platformType,
      },
      { requestContext: context?.requestContext }
    );

    return {
      interfaceId: result.interfaceId,
      versionId: result.versionId,
      previewUrl: result.previewUrl,
    };
  },
});

