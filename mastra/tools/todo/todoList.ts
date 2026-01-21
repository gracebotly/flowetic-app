



import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TodoItemSchema } from "./types";

export const todoList = createTool({
  id: "todo.list",
  description: "List todos for the current thread, filtered by status.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
  }),
  outputSchema: z.object({
    todos: z.array(TodoItemSchema),
  }),
  execute: async (inputData: any, context: any) => {
    const { tenantId, threadId } = inputData;
    const supabase = await createClient();

    const { data: todos, error } = await supabase
      .from("todos")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return { todos: todos || [] };
  },
});


