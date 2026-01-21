import { z } from "zod";

export type TodoStatus = "pending" | "in_progress" | "completed";

export type TodoPriority = "low" | "medium" | "high";

export type TodoItem = {
  id: string;
  tenant_id: string;
  thread_id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  tags: string[];
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};
