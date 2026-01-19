



import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import { TodoItem } from "./types";

export const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
  }),
  outputSchema: z.object({
    todo: TodoItem,
  }),
  execute: async ({ context }) => {
    const supabase = createClient();
    const { tenantId, threadId, todoId } = context;

    const { data, error } = await supabase
      .from("todos")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("thread_id", threadId)
      .eq("id", todoId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "TODO_COMPLETE_FAILED");
    return { todo: data };
  },
});



