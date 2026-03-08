'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { getThemeTokens } from '@/lib/portals/themeTokens';

interface DataFreshnessBarProps {
  latestEventTimestamp?: string | null;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function DataFreshnessBar({ latestEventTimestamp }: DataFreshnessBarProps) {
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);

  if (!latestEventTimestamp) return null;

  const date = new Date(latestEventTimestamp);
  if (isNaN(date.getTime())) return null;

  const timeAgo = getTimeAgo(date);

  return (
    <div
      className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5"
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.border,
      }}
    >
      <Clock className="h-3.5 w-3.5" style={{ color: tokens.textSecondary }} />
      <p className="text-xs" style={{ color: tokens.textSecondary }}>
        Data last synced {timeAgo}
      </p>
    </div>
  );
}
