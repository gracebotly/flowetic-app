import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as createClient } from '../supabase.mjs';
import { TodoItem, TodoPriority } from './9b12f16c-8041-4e73-8ea2-57e3dae10aec.mjs';
import '@supabase/supabase-js';

const todoAdd = createTool({
  id: "todo.add",
  description: "Create a new todo item for the current thread. Use for planning and progress tracking.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    title: z.string().min(1).max(160),
    description: z.string().max(2e3).optional(),
    priority: TodoPriority.optional().default("medium"),
    tags: z.array(z.string()).optional().default([]),
    parentId: z.string().uuid().optional().nullable()
  }),
  outputSchema: z.object({
    todo: TodoItem
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, title, description, priority, tags, parentId } = inputData;
    const { data, error } = await supabase.from("todos").insert({
      tenant_id: tenantId,
      thread_id: threadId,
      title,
      description: description ?? null,
      status: "pending",
      priority,
      tags,
      parent_id: parentId ?? null
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "TODO_ADD_FAILED");
    return { todo: data };
  }
});

export { todoAdd };
