


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import { ProjectPublic, ProjectStatus, ProjectType } from "./types";

export const listProjects = createTool({
  id: "projects.list",
  description: "List projects for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    type: ProjectType.optional(),
    status: ProjectStatus.optional(),
    limit: z.number().int().min(1).max(200).optional().default(50),
  }),
  outputSchema: z.object({
    projects: z.array(ProjectPublic),
  }),
  execute: async (inputData, context) => {
    const { tenantId, limit = 50 } = inputData; // Default value

    const supabase = await createClient();

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit); // Now guaranteed to be a number

    if (error) throw new Error(error.message);

    return { projects };
  }),
});
