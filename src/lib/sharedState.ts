/**
 * In-memory shared state keyed by threadId.
 * In production you should persist this in Supabase (threads.state_json).
 */
export type ThreadState = {
  mode: 'plan' | 'edit';
  phase: 'plan' | 'ready_for_preview' | 'previewing' | 'preview_ready' | 'editing' | 'deploy_ready';
  schemaReady: boolean;
  mappingComplete: boolean;
  templateId?: string;
  planTurnsCount: number;
  lastPreviewRunId?: string;
  previewVersionId?: string;
  lastStreamCursor?: string;
};

const state: Map<string, ThreadState> = new Map();

/**
 * Get the current state for a thread.  If no state exists, return undefined.
 */
export function getThreadState(threadId: string): ThreadState | undefined {
  return state.get(threadId);
}

/**
 * Update (or create) the state for a thread.  Pass only the properties you want
 * to change; the remainder of the existing state will be preserved.  If there
 * is no existing state, sensible defaults are used.
 */
export function updateThreadState(threadId: string, partial: Partial<ThreadState>): ThreadState {
  const existing: ThreadState = state.get(threadId) ?? {
    mode: 'plan',
    phase: 'plan',
    schemaReady: false,
    mappingComplete: false,
    templateId: undefined,
    planTurnsCount: 0,
    lastPreviewRunId: undefined,
    previewVersionId: undefined,
    lastStreamCursor: undefined,
  };
  const next: ThreadState = { ...existing, ...partial };
  state.set(threadId, next);
  return next;
}
