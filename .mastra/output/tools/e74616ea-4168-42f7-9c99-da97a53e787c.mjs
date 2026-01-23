import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import { ProjectStatus, ProjectType, ProjectPublic } from './49852a46-8476-4e8d-9bd5-78b1b42daddf.mjs';
import '@supabase/supabase-js';

const listProjects = createTool({
  id: "projects.list",
  description: "List projects for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    type: ProjectType.optional(),
    status: ProjectStatus.optional(),
    limit: z.number().int().min(1).max(200).optional().default(50)
  }),
  outputSchema: z.object({
    projects: z.array(ProjectPublic)
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, type, status, limit } = inputData;
    let q = supabase.from("projects").select("id, tenant_id, name, type, status, description, public_enabled, created_at, updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(limit);
    if (type) q = q.eq("type", type);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(`PROJECTS_LIST_FAILED: ${error.message}`);
    return {
      projects: (data ?? []).map((p) => ({
        id: String(p.id),
        tenantId: String(p.tenant_id),
        name: String(p.name),
        type: ProjectType.parse(String(p.type)),
        status: ProjectStatus.parse(String(p.status)),
        description: p.description === null || p.description === void 0 ? null : String(p.description),
        publicEnabled: !!p.public_enabled,
        createdAt: String(p.created_at),
        updatedAt: String(p.updated_at)
      }))
    };
  }
});

export { listProjects };
