

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const todoList = createTool({
  id: "todo.list",
  description: "List todos for the current thread, filtered by status.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    status: z.enum(["open", "in_progress", "done"]).optional(),
  }),
  outputSchema: z.object({
    todos: z.array(z.any()),
    total: z.number(),
    completed: z.number(),
  }),
  execute: async (inputData: any) => {
    const supabase = await createClient();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.id) {
      return { todos: [], total: 0, completed: 0 };
    }

    const { tenantId, threadId, status } = inputData;

    try {
      let q = supabase
        .from("todos")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (status) q = q.eq("status", status);

      const { data, error } = await q;

      if (error || !data) {
        console.error("[todo.list] failed (non-fatal)", {
          message: error?.message,
          code: (error as any)?.code,
        });
        return { todos: [], total: 0, completed: 0 };
      }

      const total = data.length;
      const completed = data.filter((t: any) => String(t?.status) === "done").length;

      return { todos: data, total, completed };
    } catch (err) {
      console.error("[todo.list] exception (non-fatal)", err);
      return { todos: [], total: 0, completed: 0 };
    }
  },
});


