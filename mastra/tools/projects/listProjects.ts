


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";
import { ProjectPublic, ProjectStatus, ProjectType } from "./types";

export const listProjects = createTool({
  id: "projects.list",
  description: "List projects for a tenant.",
  inputSchema: z.object({
    type: ProjectType.optional(),
    status: ProjectStatus.optional(),
    limit: z.number().int().min(1).max(200).optional().default(50),
  }),
  outputSchema: z.object({
    projects: z.array(ProjectPublic),
  }),
  execute: async (inputData, context) => {
    const { limit = 50 } = inputData; // Default value

    // Get access token and tenant context
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[listProjects]: Missing authentication token');
    }
    const { tenantId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit); // Now guaranteed to be a number

    if (error) throw new Error(error.message);

    return { projects };
  },
});
