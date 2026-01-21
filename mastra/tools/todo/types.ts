import { z } from "zod";

export const TodoStatusSchema = z.enum(["pending", "in_progress", "completed"]);
export type TodoStatus = z.infer<typeof TodoStatusSchema>;

export const TodoPrioritySchema = z.enum(["low", "medium", "high"]);
export type TodoPriority = z.infer<typeof TodoPrioritySchema>;

export const TodoItemSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  thread_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TodoStatusSchema,
  priority: TodoPrioritySchema,
  tags: z.array(z.string()),
  parent_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;
