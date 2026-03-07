/**
 * Platform → Skeleton Mapping
 * 
 * This is the CORE revenue function of Getflowetic.
 * Each skeleton is a premium, hardcoded dashboard layout
 * that an agency white-labels and sells to their clients.
 * 
 * Rules:
 * - Deterministic: same input → same output, every time
 * - No AI: pure lookup table
 * - Expandable: add new skeletons by adding entries
 */

export type SkeletonId = 
  | 'voice-performance'
  | 'workflow-operations'
  | 'roi-summary'
  | 'combined-overview';

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
    'voice-performance':    'Voice Performance Dashboard',
    'workflow-operations':  'Workflow Operations Dashboard',
    'roi-summary':          'ROI Summary Dashboard',
    'combined-overview':    'Combined Overview Dashboard',
  };
  return names[skeletonId] ?? 'Dashboard';
}

export function getSkeletonDescription(skeletonId: SkeletonId): string {
  const descriptions: Record<SkeletonId, string> = {
    'voice-performance':    'Call volume, success rates, duration analytics, cost tracking, and agent performance breakdown.',
    'workflow-operations':  'Execution monitoring, success/failure rates, runtime analytics, and workflow performance trends.',
    'roi-summary':          'Estimated cost savings, task completion rates, and return on investment metrics.',
    'combined-overview':    'Unified view across voice and workflow platforms with side-by-side KPIs.',
  };
  return descriptions[skeletonId] ?? '';
}


/**
 * Detect the correct skeleton from a list of platform types.
 * Used when an offering has entities from multiple sources.
 *
 * Rules:
 * - All voice (vapi/retell) → voice-performance
 * - All workflow (make/n8n) → workflow-operations
 * - Mix of voice + workflow → combined-overview
 * - Empty → workflow-operations (default)
 */
export function getSkeletonForPlatformMix(platformTypes: string[]): SkeletonId {
  if (platformTypes.length === 0) return 'workflow-operations';

  const unique = [...new Set(platformTypes)];
  const hasVoice = unique.some((p) => p === 'vapi' || p === 'retell');
  const hasWorkflow = unique.some((p) => p === 'make' || p === 'n8n');

  if (hasVoice && hasWorkflow) return 'combined-overview';
  if (hasVoice) return 'voice-performance';
  return 'workflow-operations';
}
