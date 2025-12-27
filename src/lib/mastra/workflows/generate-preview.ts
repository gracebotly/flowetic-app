import { z } from "zod";

export const GeneratePreviewInput = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(["admin", "client", "viewer"]),
  interfaceId: z.string().uuid(),
  instructions: z.string().optional(),
});

export const GeneratePreviewOutput = z.object({
  runId: z.string().uuid(),
  previewVersionId: z.string().uuid(),
  previewUrl: z.string(),
});

export type GeneratePreviewInput = z.infer<typeof GeneratePreviewInput>;
export type GeneratePreviewOutput = z.infer<typeof GeneratePreviewOutput>;
