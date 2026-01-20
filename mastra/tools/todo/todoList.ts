

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TodoItem, TodoStatus } from "./types";

export const todoList = createTool({
  id: "todo.list",
  description: "List todos for the current thread, filtered by status.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    status: z.union([TodoStatus, z.literal("all")]).default("all"),
  }),
  outputSchema: z.object({
    todos: z.array(TodoItem),
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, threadId, status } = inputData;

    let q = supabase
      .from("todos")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (status !== "all") q = q.eq("status", status);

    const { data, error } = await q;
    if (error || !data) throw new Error(error?.message ?? "TODO_LIST_FAILED");

    return { todos: data };
  },
});


