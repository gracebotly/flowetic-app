


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";

export const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
  }),
  outputSchema: z.object({
    todo: z.any().nullable(),
  }),
  execute: async (inputData: any, context: any) => {
    const accessToken = context?.requestContext?.get('supabaseAccessToken') as string;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('[todoComplete]: Missing authentication');
    }
    const { tenantId, userId } = extractTenantContext(context);
    const supabase = createAuthenticatedClient(accessToken);

    const { threadId, todoId } = inputData;

    try {
      const { data, error } = await supabase
        .from("todos")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("thread_id", threadId)
        .eq("id", todoId)
        .select("*")
        .single();

      if (error || !data) {
        console.error("[todo.complete] failed (non-fatal)", {
          message: error?.message,
          code: (error as any)?.code,
        });
        return { todo: null };
      }

      return { todo: data };
    } catch (err) {
      console.error("[todo.complete] exception (non-fatal)", err);
      return { todo: null };
    }
  },
});



