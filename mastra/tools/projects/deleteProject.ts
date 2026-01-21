








import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const deleteProject = createTool({
  id: "projects.delete",
  description: "Delete a project by ID for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    projectId: z.string().uuid(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {
    const supabase = await createClient();
    const { tenantId, projectId } = inputData;

    // Pre-check so we can return PROJECT_NOT_FOUND deterministically.
    const { data: existing, error: exErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (exErr) throw new Error(`PROJECT_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("PROJECT_NOT_FOUND");

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`PROJECT_DELETE_FAILED: ${error.message}`);

    return { success: true, message: "Project deleted successfully." };
  },
});















