


import { z } from "zod";

export const ProjectType = z.enum(["analytics", "tool", "form"]);
export const ProjectStatus = z.enum(["draft", "live"]);

export const ProjectPublic = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  type: ProjectType,
  status: ProjectStatus,
  description: z.string().nullable(),
  publicEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectType = "analytics" | "tool" | "form";
export type ProjectStatus = "draft" | "live";
export type ProjectPublic = {
  id: string;
  tenantId: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  publicEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};


