

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import type { TodoItem, TodoStatus } from "./types";

export const todoList = createTool({
  id: "todo.list",
  description: "List todos for the current thread, filtered by status.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    status: z.enum(["open", "in_progress", "done"]),
  }),
  outputSchema: z.object({
    todos: z.array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        status: z.enum(["pending", "in_progress", "completed"]),
        dueDate: z.string().optional(),
        createdAt: z.string(),
        completedAt: z.string().nullable(),
      })
    ),
    total: z.number(),
    completed: z.number(),
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, status } = inputData;

    let q = supabase
      .from("todos")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error || !data) throw new Error(error?.message ?? "TODO_LIST_FAILED");

    return { todos: data };
  },
});


