// mastra/normalizers/n8n.ts
// n8n-specific event normalization

import type { PlatformNormalizer, NormalizedEventFragment, NormalizedState } from './types';

/** Safely pluck a nested path like "labels.workflow_id" from an object */
function pluck(obj: Record<string, unknown>, path: string, fallback?: unknown): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return fallback;
    current = (current as Record<string, unknown>)[part];
  }
  return current !== undefined && current !== null ? current : fallback;
}

function computeDuration(start: unknown, end: unknown): number | undefined {
  if (!start || !end) return undefined;
  try {
    const ms = new Date(String(end)).getTime() - new Date(String(start)).getTime();
    return ms > 0 ? ms : undefined;
  } catch {
    return undefined;
  }
}

export const n8nNormalizer: PlatformNormalizer = {
  getExpectedFields(): string[] {
    return [
      'workflow_id',
      'workflow_name',
      'execution_id',
      'status',
      'started_at',
      'ended_at',
      'duration_ms',
      'error_message',
      'platform',
    ];
  },

  normalize(raw: Record<string, unknown>): NormalizedEventFragment {
    const workflowId = String(
      pluck(raw, 'labels.workflow_id', raw.workflow_id ?? raw.workflowId) ?? ''
    );
    const workflowName = String(
      pluck(raw, 'labels.workflow_name', raw.workflow_name) ?? ''
    );
    const executionId = String(
      pluck(raw, 'labels.execution_id', raw.execution_id ?? raw.id) ?? ''
    );
    const status = String(
      pluck(raw, 'labels.status', raw.status) ?? (raw.stoppedAt ? 'error' : 'success')
    );

    const startedAt = String(raw.startedAt ?? raw.timestamp ?? raw.createdAt ?? '');
    const endedAt = String(raw.stoppedAt ?? raw.finishedAt ?? raw.endedAt ?? '');
    const durationMs = computeDuration(startedAt, endedAt);
    const errorMessage = raw.stoppedAt
      ? String(pluck(raw, 'data.resultData.error.message') ?? '')
      : undefined;

    const state: NormalizedState = {
      workflow_id: workflowId,
      workflow_name: workflowName,
      execution_id: executionId,
      status,
      started_at: startedAt,
      ended_at: endedAt,
      duration_ms: durationMs,
      error_message: errorMessage,
      platform: 'n8n',
    };

    return {
      type: 'state',
      name: `n8n:${workflowName || workflowId || 'workflow'}:execution`,
      state,
      labels: {
        workflow_id: workflowId,
        workflow_name: workflowName,
        execution_id: executionId,
        status,
        platform: 'n8n',
      },
    };
  },
};
