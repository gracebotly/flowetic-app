
import { z } from "zod";

export const SourcePlatformType = z
  .enum(["vapi", "retell", "n8n", "make", "mastra", "crewai", "other"])
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

export type SourcePlatformType = "vapi" | "retell" | "n8n" | "make" | "mastra" | "crewai" | "other";

export type SourceMethod = "api" | "webhook";

export type SourceStatus = "active" | "inactive" | "error";

export type SourcePublic = {
  id: string;
  tenantId: string;
  type: SourcePlatformType;
  name: string;
  method: SourceMethod;
  status: SourceStatus;
  createdAt: string;
};
