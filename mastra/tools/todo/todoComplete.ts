


import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TodoItemSchema } from "./types";

export const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    todoId: z.string().uuid(),
  }),
  outputSchema: z.object({
    todo: TodoItemSchema,
  }),
  execute: async (inputData: any, context: any) => {
    const { tenantId, todoId } = inputData;
    const supabase = await createClient();

    const { data: todo, error } = await supabase
      .from("todos")
      .update({ status: "completed" })
      .eq("id", todoId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!todo) throw new Error("TODO_NOT_FOUND");

    return { todo };
  },
});

