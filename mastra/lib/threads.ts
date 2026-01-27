import { randomUUID } from 'node:crypto';

export interface MemoryContext {
  resource: string;  // User-facing session ID (journey_sessions.id)
  thread: string;     // Mastra's internal thread UUID
}

/**
 * Generate a new thread UUID for Mastra Memory
 */
export function generateThreadId(): string {
  return randomUUID();
}

/**
 * Get memory context from journey session
 */
export function getMemoryContext(session: {
  id: string;
  mastra_thread_id?: string | null;
}): MemoryContext | null {
  if (!session.mastra_thread_id) {
    return null;
  }
  return {
    resource: session.id,
    thread: session.mastra_thread_id,
  };
}
