// mastra/normalizers/index.ts
// Static registry of platform normalizers.
// Import all normalizers here — no dynamic imports needed.

import type { PlatformNormalizer, NormalizedEventFragment } from './types';
import { n8nNormalizer } from './n8n';
// Future: import { makeNormalizer } from './make';
// Future: import { vapiNormalizer } from './vapi';
// Future: import { retellNormalizer } from './retell';

/**
 * Registry mapping platformType → normalizer implementation.
 * Add new platforms here as you build them.
 */
const normalizerRegistry: Record<string, PlatformNormalizer> = {
  n8n: n8nNormalizer,
  // make: makeNormalizer,
  // vapi: vapiNormalizer,
  // retell: retellNormalizer,
};

/**
 * Generic fallback normalizer for platforms that don't have a specific
 * normalizer yet. Preserves the raw event in state so nothing is lost,
 * but also extracts what it can from common field names.
 */
const genericNormalizer: PlatformNormalizer = {
  getExpectedFields(): string[] {
    return ['status', 'started_at', 'platform'];
  },

  normalize(raw: Record<string, unknown>): NormalizedEventFragment {
    return {
      type: 'state',
      name: `unknown:event`,
      state: {
        workflow_id: String(raw.workflow_id ?? raw.workflowId ?? raw.scenario_id ?? ''),
        workflow_name: String(raw.workflow_name ?? raw.scenario_name ?? ''),
        execution_id: String(raw.execution_id ?? raw.id ?? ''),
        status: String(raw.status ?? 'unknown'),
        started_at: String(raw.timestamp ?? raw.startedAt ?? raw.createdAt ?? ''),
        ended_at: String(raw.endedAt ?? raw.stoppedAt ?? raw.finishedAt ?? ''),
        platform: 'unknown',
      },
      labels: {
        platform: 'unknown',
      },
    };
  },
};

/**
 * Get the normalizer for a given platform type.
 * Returns the platform-specific normalizer if available, otherwise the generic fallback.
 */
export function getNormalizer(platformType: string): PlatformNormalizer {
  return normalizerRegistry[platformType] ?? genericNormalizer;
}

/**
 * Get expected fields for a platform (useful for analyzeSchema confidence boosting).
 */
export function getExpectedFieldsForPlatform(platformType: string): string[] {
  const normalizer = normalizerRegistry[platformType];
  return normalizer ? normalizer.getExpectedFields() : genericNormalizer.getExpectedFields();
}

// Re-export types for convenience
export type { PlatformNormalizer, NormalizedEventFragment, NormalizedState } from './types';
