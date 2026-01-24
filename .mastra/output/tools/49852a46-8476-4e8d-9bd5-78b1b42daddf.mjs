import { z } from 'zod';

const ProjectType = z.enum(["analytics", "tool", "form"]);
const ProjectStatus = z.enum(["draft", "live"]);
const ProjectPublic = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  type: ProjectType,
  status: ProjectStatus,
  description: z.string().nullable(),
  publicEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export { ProjectPublic, ProjectStatus, ProjectType };
