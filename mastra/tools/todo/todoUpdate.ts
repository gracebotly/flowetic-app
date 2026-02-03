


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createAuthenticatedClient } from "../../lib/supabase";
import { extractTenantContext } from "../../lib/tenant-verification";
import type { TodoItem, TodoPriority, TodoStatus } from "./types";

export const todoUpdate = createTool({
  id: "todo.update",
  description: "Update a todo item (status/title/description/priority/tags).",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
    status: z.enum(["pending", "in_progress", "completed"]).describe("New status"),
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional().nullable(),
    priority: z.enum(["low", "medium", "high", "urgent"]).describe("New priority"),
    tags: z.array(z.string()).optional(),
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
      completedAt: z.string().nullable(),
    }),
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



