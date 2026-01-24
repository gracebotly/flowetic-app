import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import { TodoItem } from './9b12f16c-8041-4e73-8ea2-57e3dae10aec.mjs';
import '@supabase/supabase-js';

const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid()
  }),
  outputSchema: z.object({
    todo: TodoItem
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, todoId } = inputData;
    const { data, error } = await supabase.from("todos").update({ status: "completed", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("tenant_id", tenantId).eq("thread_id", threadId).eq("id", todoId).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "TODO_COMPLETE_FAILED");
    return { todo: data };
  }
});

export { todoComplete };
