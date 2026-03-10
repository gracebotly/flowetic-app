/**
 * Platform → Skeleton Mapping
 *
 * Rules:
 * - Deterministic: same input → same output, every time
 * - No AI: pure lookup table
 * - Expandable: add new skeletons by adding entries
 */

export type SkeletonId =
  | 'voice-performance'
  | 'multi-agent-voice'
  | 'workflow-operations'
  | 'roi-summary';

export type PlatformType = 'vapi' | 'retell' | 'n8n' | 'make';

const PLATFORM_SKELETON_MAP: Record<PlatformType, SkeletonId> = {
  vapi:   'voice-performance',
  retell: 'voice-performance',
  n8n:    'workflow-operations',
  make:   'workflow-operations',
} as const;

export function getSkeletonForPlatform(platformType: string): SkeletonId {
  return PLATFORM_SKELETON_MAP[platformType as PlatformType] ?? 'workflow-operations';
}

export function getSkeletonDisplayName(skeletonId: SkeletonId): string {
  const names: Record<SkeletonId, string> = {
    'voice-performance':   'Voice Performance Dashboard',
    'multi-agent-voice':   'Multi-Agent Voice Dashboard',
    'workflow-operations': 'Workflow Operations Dashboard',
    'roi-summary':         'ROI Summary Dashboard',
  };
  return names[skeletonId] ?? 'Dashboard';
}

export function getSkeletonDescription(skeletonId: SkeletonId): string {
  const descriptions: Record<SkeletonId, string> = {
    'voice-performance':   'Call volume, success rates, duration analytics, cost tracking, and agent performance breakdown.',
    'multi-agent-voice':   'Per-agent tabs with individual KPIs, call trends, and activity feeds for 2–5 voice agents.',
    'workflow-operations': 'Execution monitoring, success/failure rates, runtime analytics, and workflow performance trends.',
    'roi-summary':         'Estimated cost savings, task completion rates, and return on investment metrics.',
  };
  return descriptions[skeletonId] ?? '';
}

/**
 * Detect the correct skeleton from a list of platform types and entity count.
 *
 * Rules:
 * - All voice, 1 entity  → voice-performance
 * - All voice, 2+ entities → multi-agent-voice
 * - All workflow, any count → workflow-operations
 * - Mixed voice + workflow → NOT SUPPORTED — caller must prevent this
 * - Empty → workflow-operations (default)
 */
export function getSkeletonForPlatformMix(
  platformTypes: string[],
  entityCount: number = 1,
): SkeletonId {
  if (platformTypes.length === 0) return 'workflow-operations';

  const unique = [...new Set(platformTypes)];
  const hasVoice = unique.some((p) => p === 'vapi' || p === 'retell');
  const hasWorkflow = unique.some((p) => p === 'make' || p === 'n8n');

  // Mixed selection is not supported — fall back to workflow
  if (hasVoice && hasWorkflow) return 'workflow-operations';

  if (hasVoice) {
    return entityCount >= 2 ? 'multi-agent-voice' : 'voice-performance';
  }

  return 'workflow-operations';
}
