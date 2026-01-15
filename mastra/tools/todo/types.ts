import { z } from "zod";

export const TodoStatus = z.enum(["pending", "in_progress", "completed"]);
export type TodoStatus = z.infer<typeof TodoStatus>;

export const TodoPriority = z.enum(["low", "medium", "high"]);
export type TodoPriority = z.infer<typeof TodoPriority>;

export const TodoItem = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  thread_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TodoStatus,
  priority: TodoPriority,
  tags: z.array(z.string()),
  parent_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TodoItem = z.infer<typeof TodoItem>;
