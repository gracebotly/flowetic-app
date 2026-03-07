'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, XCircle, Activity, WifiOff } from 'lucide-react';

export type EntityHealth =
  | { status: 'healthy' }
  | { status: 'degraded'; errorRate: number; errorCount: number }
  | { status: 'critical'; errorRate: number; latestError: string }
  | { status: 'no-data'; entityKind: string }
  | { status: 'fetch-error'; error: string };

interface HealthBannerProps {
  health: EntityHealth;
  platformLabel?: string;
  onRetry?: () => void;
}

export function HealthBanner({ health, platformLabel, onRetry }: HealthBannerProps) {
  if (health.status === 'healthy') {
    return null;
  }

  if (health.status === 'degraded') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-lg border border-amber-200 bg-amber-50 p-3"
      >
        <div className="flex gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-amber-800">Performance Issues Detected</div>
            <div className="mt-0.5 text-xs text-amber-700">
              This entity has a {health.errorRate}% failure rate. Review recent errors before sharing with clients.
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (health.status === 'critical') {
    const latestError =
      health.latestError.length > 200 ? `${health.latestError.slice(0, 200)}…` : health.latestError;

    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-lg border border-red-200 bg-red-50 p-3"
      >
        <div className="flex gap-2.5">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-red-800">All Recent Executions Failed</div>
            <div className="mt-0.5 break-words text-xs text-red-700">{latestError}</div>
            <div className="mt-1 text-xs text-red-700">Fix issues before creating a client portal.</div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (health.status === 'no-data') {
    const noun = health.entityKind || 'entity';
    const hint =
      noun === 'agent'
        ? "Once calls come in, you'll see transcripts and metrics here."
        : "Once executions run, you'll see health signals and metrics here.";

    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="py-8 text-center"
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <Activity className="h-4 w-4 text-gray-400" />
        </div>
        <div className="text-sm font-medium text-gray-600">No activity recorded yet</div>
        <div className="mt-1 text-xs text-gray-400">{hint}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <div className="flex gap-2.5">
        <WifiOff className="h-4 w-4 shrink-0 text-gray-500" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-700">Couldn&apos;t load data from {platformLabel ?? 'platform'}</div>
          <div className="mt-0.5 break-words text-xs text-gray-500">{health.error}</div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-xs text-gray-600 underline transition-colors duration-200 hover:text-gray-900"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
