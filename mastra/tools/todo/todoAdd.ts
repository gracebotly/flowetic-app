
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { TodoItem } from "./types";
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from "@mastra/core/request-context";

export const todoAdd = createTool({
  id: "todo.add",
  description: "Create a new todo item for the current thread. Use for planning and progress tracking.",
  inputSchema: z.object({
  tenantId: z.string().uuid().optional(),
  threadId: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).describe("Priority"),
  tags: z.array(z.string()).optional().default([]),
  parentId: z.string().uuid().optional().nullable(),
}),
  outputSchema: z.object({
  id: z.string().uuid(),
  todo: z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.enum(["pending", "in_progress", "completed"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
    dueDate: z.string().optional(),
  }),
}),
execute: async (inputData, context) => {
  const { tenantId: explicitTenantId, threadId: explicitThreadId, title, description, priority, tags, parentId } =
    inputData;

  const tenantId =
    explicitTenantId ??
    (context?.requestContext?.get("tenantId") as string | undefined) ??
    (context?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined);

  const threadId =
    explicitThreadId ??
    (context?.requestContext?.get("threadId") as string | undefined) ??
    (context?.requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined);

  if (!tenantId || !threadId) {
    throw new Error("Missing required parameters: tenantId and threadId are required");
  }

  // Use authenticated client for RLS operations (Next.js server cookies)
  const { createClient } = await import("../../../src/lib/supabase/server");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("todos")
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      title,
      description: description ?? null,
      status: "pending",
      priority,
      tags: tags ?? [],
      parent_id: parentId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "TODO_ADD_FAILED");

  // Map DB row -> tool output contract
  const todo: TodoItem = {
    id: data.id,
    title: data.title,
    status: data.status,
    priority: data.priority,
    createdAt: data.created_at,
    completedAt: null,
    dueDate: undefined,
  };

  return { id: data.id, todo };
},
});

