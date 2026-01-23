import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { persistPreviewVersion } from './2afe9f7b-3baa-40e6-b81f-d049ec3a95c3.mjs';
import '../supabase.mjs';
import '@supabase/supabase-js';

const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description: "Persist a validated spec_json + design_tokens as a new preview interface version. Reads tenantId/userId/interfaceId/platformType from runtimeContext when available.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).default({}),
    interfaceId: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string()
  }),
  execute: async ({ context, runtimeContext }) => {
    const tenantId = runtimeContext?.get("tenantId");
    const userId = runtimeContext?.get("userId");
    const platformType = runtimeContext?.get("platformType") ?? "make";
    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");
    const interfaceId = inputData.interfaceId ?? runtimeContext?.get("interfaceId") ?? void 0;
    const result = await persistPreviewVersion.execute({
      context: {
        tenantId,
        userId,
        interfaceId,
        spec_json: inputData.spec_json,
        design_tokens: inputData.design_tokens ?? {},
        platformType
      },
      runtimeContext
    });
    return {
      interfaceId: result.interfaceId,
      versionId: result.versionId,
      previewUrl: result.previewUrl
    };
  }
});

export { savePreviewVersion };
