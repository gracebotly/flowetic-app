import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import { ProjectStatus, ProjectType, ProjectPublic } from './49852a46-8476-4e8d-9bd5-78b1b42daddf.mjs';
import '@supabase/supabase-js';

const createProject = createTool({
  id: "projects.create",
  description: "Create a new project for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1).max(120),
    type: ProjectType,
    description: z.string().max(2e3).optional(),
    publicEnabled: z.boolean().optional().default(false)
  }),
  outputSchema: z.object({
    project: ProjectPublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await supabase.from("projects").insert({
      tenant_id: inputData.tenantId,
      name: inputData.name,
      type: inputData.type,
      status: "draft",
      description: inputData.description ?? null,
      public_enabled: inputData.publicEnabled ?? false,
      created_at: now,
      updated_at: now
    }).select("id, tenant_id, name, type, status, description, public_enabled, created_at, updated_at").single();
    if (error || !data) throw new Error(`PROJECT_CREATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      project: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        name: String(data.name),
        type: ProjectType.parse(String(data.type)),
        status: ProjectStatus.parse(String(data.status)),
        description: data.description === null || data.description === void 0 ? null : String(data.description),
        publicEnabled: !!data.public_enabled,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at)
      },
      message: `Project "${String(data.name)}" created.`
    };
  }
});

export { createProject };
