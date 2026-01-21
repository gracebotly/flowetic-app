




import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TodoItemSchema } from "./types";

export const todoUpdate = createTool({
  id: "todo.update",
  description: "Update todo fields (title, description, priority, status).",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    todoId: z.string().uuid(),
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(["pending", "in_progress", "completed"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  outputSchema: z.object({
    todo: TodoItemSchema,
  }),
  execute: async (inputData: any, context: any) => {
    const { tenantId, todoId, ...updates } = inputData;
    const supabase = await createClient();

    const { data: todo, error } = await supabase
      .from("todos")
      .update(updates)
      .eq("id", todoId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!todo) throw new Error("TODO_NOT_FOUND");

    return { todo };
  },
});



