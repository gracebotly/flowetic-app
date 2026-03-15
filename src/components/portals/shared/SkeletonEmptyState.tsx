'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, XCircle, Info } from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { getThemeTokens, STATUS } from '@/lib/portals/themeTokens';
import { fadeUp } from '@/components/portals/shared/portalPrimitives';

interface SkeletonHealthBannerProps {
  health: {
    status: 'healthy' | 'degraded' | 'critical' | 'no-data' | 'sparse';
    errorRate: number;
    eventCount: number;
    latestError?: string;
  };
  entityType?: 'voice' | 'workflow' | 'combined';
  /** When false (default), hides degraded/critical/sparse banners — client-facing portals only show no-data */
  isAgencyView?: boolean;
}

export function SkeletonHealthBanner({ health, entityType = 'workflow', isAgencyView = false }: SkeletonHealthBannerProps) {
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const isDark = theme === 'dark';

  const callOrExec = entityType === 'voice' ? 'calls' : 'executions';

  if (health.status === 'healthy') return null;

  if (health.status === 'no-data') {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderColor: tokens.border,
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          >
            <Activity className="h-6 w-6" style={{ color: tokens.textSecondary }} />
          </div>
          <h3 className="text-base font-semibold" style={{ color: tokens.textPrimary }}>
            No activity recorded yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: tokens.textSecondary }}>
            {entityType === 'voice'
              ? 'Activity data will appear here once calls are received. Check back soon.'
              : 'Activity data will appear here once executions are recorded. Check back soon.'}
          </p>
        </div>
      </motion.div>
    );
  }

  // Client-facing portals: never show performance warnings — only show empty state
  if (!isAgencyView) return null;

  if (health.status === 'critical') {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
            borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#fecaca',
          }}
        >
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: STATUS.error }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: isDark ? '#fca5a5' : '#991b1b' }}>
                All recent {callOrExec} encountered issues
              </p>
              <p className="mt-1 text-sm" style={{ color: isDark ? '#fca5a5' : '#b91c1c' }}>
                The last {health.eventCount} {callOrExec} all resulted in errors. The service provider is investigating.
              </p>
              {health.latestError && health.latestError !== '—' && (
                <p
                  className="mt-2 rounded-lg border px-3 py-2 font-mono text-xs"
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                    borderColor: isDark ? 'rgba(239,68,68,0.2)' : '#fecaca',
                    color: isDark ? '#fca5a5' : '#991b1b',
                  }}
                >
                  {health.latestError.length > 120 ? health.latestError.slice(0, 120) + '…' : health.latestError}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (health.status === 'degraded') {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
            borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#fde68a',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: STATUS.warning }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: isDark ? '#fcd34d' : '#92400e' }}>
                Performance issues detected
              </p>
              <p className="mt-1 text-sm" style={{ color: isDark ? '#fcd34d' : '#a16207' }}>
                {health.errorRate}% of recent {callOrExec} encountered errors. Review is recommended.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (health.status === 'sparse') {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <div
          className="rounded-xl border p-3"
          style={{
            backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)',
            borderColor: isDark ? 'rgba(59,130,246,0.2)' : '#bfdbfe',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 flex-shrink-0" style={{ color: isDark ? '#60a5fa' : '#2563eb' }} />
            <p className="text-sm" style={{ color: isDark ? '#93c5fd' : '#1e40af' }}>
              Based on limited data ({health.eventCount} {callOrExec}). Analytics will improve as more activity is recorded.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
