import { z } from 'zod';

const TodoStatus = z.enum(["pending", "in_progress", "completed"]);
const TodoPriority = z.enum(["low", "medium", "high"]);
const TodoItem = z.object({
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
  updated_at: z.string()
});

export { TodoItem, TodoPriority, TodoStatus };
