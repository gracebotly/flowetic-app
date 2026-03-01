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
