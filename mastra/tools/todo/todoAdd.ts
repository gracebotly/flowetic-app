
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

const TodoPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const todoAdd = createTool({
  id: "todo.add",
  description: "Create a new todo item for the current thread. Use for planning and progress tracking.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    title: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    priority: TodoPrioritySchema.optional().default("medium"),
    tags: z.array(z.string()).optional().default([]),
    parentId: z.string().uuid().optional().nullable(),
  }),
  outputSchema: z.object({
    todo: z.any().nullable(),
  }),
  execute: async (inputData: any, context: any) => {
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[todoAdd]: Missing authentication');
    }
    const { tenantId, userId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { threadId, title, description, priority, tags, parentId } = inputData;

    try {
      const { data, error } = await supabase
        .from("todos")
        .insert({
          tenant_id: tenantId,
          thread_id: threadId,
          title,
          description: description ?? null,
          status: "open",
          priority: priority ?? "medium",
          tags: tags ?? [],
          parent_id: parentId ?? null,
        })
        .select("*")
        .single();

      if (error || !data) {
        console.error("[todo.add] failed (non-fatal)", {
          message: error?.message,
          code: (error as any)?.code,
        });
        return { todo: null };
      }

      return { todo: data };
    } catch (err) {
      console.error("[todo.add] exception (non-fatal)", err);
      return { todo: null };
    }
  },
});
