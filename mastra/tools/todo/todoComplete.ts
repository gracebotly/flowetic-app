


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
  }),
  outputSchema: z.object({
    todo: z.any().nullable(),
  }),
  execute: async (inputData: any) => {
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.id) {
      return { todo: null };
    }

    const { tenantId, threadId, todoId } = inputData;

    try {
      const { data, error } = await supabase
        .from("todos")
        .update({ status: "done", updated_at: new Date().toISOString() })
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



