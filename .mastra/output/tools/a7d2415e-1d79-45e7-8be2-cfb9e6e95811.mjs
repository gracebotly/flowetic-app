import { z } from 'zod';

const SourcePlatformType = z.enum(["vapi", "retell", "n8n", "make", "activepieces", "mastra", "crewai", "other"]).describe("Supported connection platform types.");
const SourceMethod = z.enum(["api", "webhook"]).describe("Connection method (API key vs webhook).");
const SourceStatus = z.enum(["active", "inactive", "error"]).describe("High-level connection health/status.");
const SourcePublic = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: SourcePlatformType,
  name: z.string(),
  method: SourceMethod,
  status: SourceStatus,
  createdAt: z.string()
});

export { SourceMethod, SourcePlatformType, SourcePublic, SourceStatus };
