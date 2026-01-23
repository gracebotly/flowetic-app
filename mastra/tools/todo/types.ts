import { z } from "zod";

export const TodoPrioritySchema = z.enum(["low", "medium", "high"]);
export type TodoPriority = z.infer<typeof TodoPrioritySchema>;

export const TodoStatusSchema = z.enum(["open", "in_progress", "done"]);
export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const TodoItemSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  thread_id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  priority: TodoPrioritySchema,
  status: TodoStatusSchema,
  tags: z.array(z.string()).optional().default([]),
  parent_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;


