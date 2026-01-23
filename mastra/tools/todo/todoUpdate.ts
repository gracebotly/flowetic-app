


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import type { TodoItem, TodoPriority, TodoStatus } from "./types";

export const todoUpdate = createTool({
  id: "todo.update",
  description: "Update a todo item (status/title/description/priority/tags).",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
    status: TodoStatus.optional(),
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional().nullable(),
    priority: TodoPriority.optional(),
    tags: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    todo: TodoItem,
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, todoId, ...patch } = inputData;

    const { data, error } = await supabase
      .from("todos")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("thread_id", threadId)
      .eq("id", todoId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "TODO_UPDATE_FAILED");
    return { todo: data };
  },
});



