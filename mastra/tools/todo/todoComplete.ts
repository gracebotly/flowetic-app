



import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";


export type TodoStatus = "pending" | "in_progress" | "completed";
export type TodoPriority = "low" | "medium" | "high";
export type TodoItem = {
  id: string;
  tenant_id: string;
  thread_id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  tags: string[];
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};


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
  execute: async ({ context, runtimeContext }: { context: any; runtimeContext: any }) => {
    const supabase = await createClient();
    const { tenantId, threadId, todoId } = inputData;

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



