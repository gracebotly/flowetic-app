import { z } from "zod";

export const PublishInput = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(["admin", "client", "viewer"]),
  interfaceId: z.string().uuid(),
  versionId: z.string().uuid(),
  route: z.string().min(1),
  confirm: z.boolean(),
});

export const PublishOutput = z.object({
  runId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  publishedUrl: z.string(),
});

export type PublishInput = {
  tenantId: string;
  userId: string;
  userRole: 'admin' | 'client' | 'viewer';
  interfaceId: string;
  versionId: string;
  route: string;
  confirm: boolean;
};

export type PublishOutput = {
  runId: string;
  deploymentId: string;
  publishedUrl: string;
};
