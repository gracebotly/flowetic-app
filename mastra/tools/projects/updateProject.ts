






import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ProjectPublic, ProjectStatus, ProjectType } from "./types";

export const updateProject = createTool({
  id: "projects.update",
  description: "Update a project (name/type/status/description/publicEnabled) for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    type: ProjectType.optional(),
    status: ProjectStatus.optional(),
    description: z.string().max(2000).nullable().optional(),
    publicEnabled: z.boolean().optional(),
  }),
  outputSchema: z.object({
    project: ProjectPublic,
    message: z.string(),
  }),
  execute: async (inputData: any, context: any) => {
    const supabase = await createClient();

    const updates: Record<string, any> = {};
    if (inputData.name !== undefined) updates.name = inputData.name;
    if (inputData.type !== undefined) updates.type = inputData.type;
    if (inputData.status !== undefined) updates.status = inputData.status;
    if (inputData.description !== undefined) updates.description = inputData.description;
    if (inputData.publicEnabled !== undefined) updates.public_enabled = inputData.publicEnabled;

    if (Object.keys(updates).length === 0) throw new Error("NO_FIELDS_TO_UPDATE");

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", inputData.projectId)
      .eq("tenant_id", inputData.tenantId)
      .select("id, tenant_id, name, type, status, description, public_enabled, created_at, updated_at")
      .single();

    if (error || !data) throw new Error(`PROJECT_UPDATE_FAILED: ${error?.message ?? "NO_DATA"}`);

    return {
      project: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        name: String(data.name),
        type: ProjectType.parse(String(data.type)),
        status: ProjectStatus.parse(String(data.status)),
        description: data.description === null || data.description === undefined ? null : String(data.description),
        publicEnabled: !!data.public_enabled,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at),
      },
      message: "Project updated successfully.",
    };
  },
});





