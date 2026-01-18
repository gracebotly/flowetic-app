
import { z } from "zod";

export const SourcePlatformType = z
  .enum(["vapi", "retell", "n8n", "make", "activepieces", "mastra", "crewai", "other"])
  .describe("Supported connection platform types.");

export const SourceMethod = z
  .enum(["api", "webhook"])
  .describe("Connection method (API key vs webhook).");

export const SourceStatus = z
  .enum(["active", "inactive", "error"])
  .describe("High-level connection health/status.");

export const SourcePublic = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: SourcePlatformType,
  name: z.string(),
  method: SourceMethod,
  status: SourceStatus,
  createdAt: z.string(),
});

export type SourcePlatformType = z.infer<typeof SourcePlatformType>;
export type SourceMethod = z.infer<typeof SourceMethod>;
export type SourceStatus = z.infer<typeof SourceStatus>;
export type SourcePublic = z.infer<typeof SourcePublic>;
