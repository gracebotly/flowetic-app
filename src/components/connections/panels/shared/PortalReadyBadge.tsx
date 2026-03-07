'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { CheckCircle2, AlertTriangle, XCircle, Circle, WifiOff } from 'lucide-react';
import type { EntityHealth } from './HealthBanner';

interface PortalReadyBadgeProps {
  health: EntityHealth;
}

export function PortalReadyBadge({ health }: PortalReadyBadgeProps) {
  const config =
    health.status === 'healthy'
      ? {
          icon: CheckCircle2,
          label: 'Ready',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          iconClassName: 'text-emerald-500',
          tooltip: 'This entity has data and no recent errors. Ready to create a portal.',
        }
      : health.status === 'degraded'
        ? {
            icon: AlertTriangle,
            label: 'Issues',
            className: 'border-amber-200 bg-amber-50 text-amber-700',
            iconClassName: 'text-amber-500',
            tooltip: `${health.errorCount} errors detected. Review before sharing.`,
          }
        : health.status === 'critical'
          ? {
              icon: XCircle,
              label: 'Blocked',
              className: 'border-red-200 bg-red-50 text-red-700',
              iconClassName: 'text-red-500',
              tooltip: 'All recent runs failed. Fix errors first.',
            }
          : health.status === 'no-data'
            ? {
                icon: Circle,
                label: 'No data',
                className: 'border-gray-200 bg-gray-50 text-gray-500',
                iconClassName: 'text-gray-400',
                tooltip: 'No activity recorded yet.',
              }
            : {
                icon: WifiOff,
                label: 'Error',
                className: 'border-gray-200 bg-gray-50 text-gray-500',
                iconClassName: 'text-gray-400',
                tooltip: health.error,
              };

  const Icon = config.icon;

  return (
    <Tooltip.Provider delayDuration={120}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors duration-200 ${config.className}`}
          >
            <Icon className={`h-3.5 w-3.5 ${config.iconClassName}`} />
            {config.label}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
            sideOffset={5}
          >
            {config.tooltip}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
