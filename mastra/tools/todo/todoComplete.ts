



import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import type { TodoItem } from "./types";

export const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
  }),
  outputSchema: z.object({
    id: z.string().uuid(),
    todo: z.object({
      id: z.string().uuid(),
      title: z.string(),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      status: z.enum(["pending", "in_progress", "completed"]),
      dueDate: z.string().optional(),
      createdAt: z.string(),
      completedAt: z.string(),
    }),
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, todoId } = inputData;

    const { data, error } = await supabase
      .from("todos")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("thread_id", threadId)
      .eq("id", todoId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "TODO_COMPLETE_FAILED");
    return { todo: data };
  },
});



