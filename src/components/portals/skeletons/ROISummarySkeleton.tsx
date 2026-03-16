'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Flex } from '@tremor/react';
import {
  Activity,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { ThemedCard, KPICard, fadeUp } from '@/components/portals/shared/portalPrimitives';
import { getThemeTokens, STATUS } from '@/lib/portals/themeTokens';
import { SkeletonHealthBanner } from '@/components/portals/shared/SkeletonEmptyState';
import { DataFreshnessBar } from '@/components/portals/shared/DataFreshnessBar';
import type { SkeletonData } from '@/lib/portals/transformData';

interface ROISummaryProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

function alpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const base = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(base.slice(0, 6), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function ROISummarySkeleton({ data }: ROISummaryProps) {
  const { headline, kpis, trend, recentRows } = data;
  const { theme } = usePortalTheme();

  if (data.health.status === 'no-data') {
    return (
      <div className="space-y-6">
        <SkeletonHealthBanner health={data.health} entityType="workflow" isAgencyView={false} />
      </div>
    );
  }

  const tokens = getThemeTokens(theme);

  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Tasks Done': { icon: Activity, color: STATUS.info },
    'Hours Saved': { icon: Clock, color: STATUS.success },
    'Cost per Task': { icon: DollarSign, color: STATUS.warning },
  };

  return (
    <div className="space-y-6">
      {(data.health.status === 'critical' || data.health.status === 'degraded' || data.health.status === 'sparse') && (
        <SkeletonHealthBanner health={data.health} entityType="workflow" isAgencyView={false} />
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={STATUS.success}>
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${STATUS.success}, ${alpha(STATUS.success, 0.65)})` }}
          />
          <Flex justifyContent="between" alignItems="center" className="pt-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>ROI Summary</p>
              <p className="mt-1 text-3xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                Est. ${headline.total.toLocaleString()} saved this month
              </p>
              <p className="mt-1 text-sm" style={{ color: tokens.textSecondary }}>{headline.periodLabel}</p>
            </div>
            {headline.percentChange !== null && (
              <div
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{
                  backgroundColor: headline.percentChange >= 0 ? `${STATUS.success}10` : `${STATUS.error}10`,
                  color: headline.percentChange >= 0 ? STATUS.success : STATUS.error,
                }}
              >
                {headline.percentChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
              </div>
            )}
          </Flex>
        </ThemedCard>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => {
          const iconConfig = kpiIcons[kpi.label] || { icon: Activity, color: STATUS.info };
          return (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={iconConfig.icon}
              color={iconConfig.color}
              index={i + 1}
              tokens={tokens}
            />
          );
        })}
      </div>

      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <ThemedCard>
            <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Cumulative Savings — 30d</p>
            <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Projected savings accumulated over time</p>
            <AreaChart
              className="mt-4 h-72"
              data={trend}
              index="date"
              categories={['count']}
              colors={['emerald']}
              valueFormatter={(v: number) => `$${v.toLocaleString()}`}
              showAnimation
              curveType="monotone"
              showGridLines={false}
            />
          </ThemedCard>
        </motion.div>
      )}

      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
          <ThemedCard>
            <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Breakdown by Event Type</p>
            <div className="mt-4 overflow-hidden rounded-lg" style={{ border: `1px solid ${tokens.border}` }}>
              <div className="overflow-x-auto">
                <div className="min-w-[360px]">
                  <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-semibold uppercase" style={{ backgroundColor: tokens.bgExpanded, color: tokens.textSecondary }}>
                    <span>Type</span>
                    <span>Count</span>
                    <span>Est Savings</span>
                    <span>Cost / Task</span>
                  </div>
                  <div>
                    {recentRows.map((row) => (
                      <div key={String(row.id)} className="grid grid-cols-4 gap-2 px-4 py-3 text-sm" style={{ borderTop: `1px solid ${tokens.border}` }}>
                        <span style={{ color: tokens.textPrimary }}>{String(row.type)}</span>
                        <span style={{ color: tokens.textSecondary }}>{String(row.count)}</span>
                        <span style={{ color: STATUS.success }}>{String(row.estSavings)}</span>
                        <span style={{ color: tokens.textSecondary }}>{String(row.costPerTask)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ThemedCard>
        </motion.div>
      )}

      <DataFreshnessBar latestEventTimestamp={recentRows[0]?.time as string} />
    </div>
  );
}
