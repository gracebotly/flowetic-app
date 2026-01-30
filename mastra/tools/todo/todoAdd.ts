
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "../../lib/supabase";
import type { TodoItem, TodoPriority } from "./types";
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from "@mastra/core/request-context";

export const todoAdd = createTool({
  id: "todo.add",
  description: "Create a new todo item for the current thread. Use for planning and progress tracking.",
  inputSchema: z.object({
    tenantId: z.string().uuid().optional(),
    threadId: z.string().uuid().optional(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
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
    // Destructure inputData for explicit parameters passed by agent
    const { tenantId: explicitTenantId, threadId: explicitThreadId, title, description, priority, tags } = inputData;
    
    // THREE-LAYER FALLBACK: explicit param → standard context → reserved key
    const tenantId = explicitTenantId 
      ?? context?.requestContext?.get("tenantId")
      ?? context?.requestContext?.get(MASTRA_RESOURCE_ID_KEY);

    const threadId = explicitThreadId 
      ?? context?.requestContext?.get("threadId")
      ?? context?.requestContext?.get(MASTRA_THREAD_ID_KEY);
    
    // Validate required parameters
    if (!tenantId || !threadId) {
      throw new Error("Missing required parameters: tenantId and threadId are required");
    }
    
    // Use authenticated client for RLS operations
    const { createClient } = await import('../../../src/lib/supabase/server');
    const supabase = await createClient();
    
    const { data: newTodo, error } = await supabase
      .from("todos")
      .insert({
        tenant_id: tenantId,
        thread_id: threadId,
        title,
        description: description || null,
        status: "pending",
        priority: priority || "medium",
        tags: tags || [],
      })
      .select()
      .single();
  
    if (error) {
      throw new Error(`Failed to create todo: ${error.message}`);
    }
    
    return {
      id: newTodo.id,
      tenantId: tenantId, // Use the resolved tenantId
      threadId: threadId, // Use the resolved threadId
      title: newTodo.title,
      status: newTodo.status,
      priority: newTodo.priority,
      tags: newTodo.tags,
      createdAt: newTodo.created_at,
    };
  },
});

