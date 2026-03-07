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
import { getThemeTokens, STATUS, type ThemeTokens } from '@/lib/portals/themeTokens';
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45 },
  }),
};

function alpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const base = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(base.slice(0, 6), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function ThemedCard({ children, className = '', glow = false, accentColor }: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  accentColor?: string;
}) {
  const { theme } = usePortalTheme();
  const isDark = theme === 'dark';
  const tokens = getThemeTokens(theme);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 ${className}`}
      style={{
        backgroundColor: tokens.bgCard,
        borderColor: tokens.border,
        boxShadow: glow && accentColor
          ? `0 0 40px ${accentColor}15, 0 1px 3px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`
          : `0 1px 3px rgba(0,0,0,${isDark ? '0.3' : '0.08'})`,
      }}
    >
      {children}
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color, index, tokens }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  index: number;
  tokens: ThemeTokens;
}) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={index}>
      <ThemedCard>
        <Flex justifyContent="between" alignItems="start">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </Flex>
      </ThemedCard>
    </motion.div>
  );
}

export function ROISummarySkeleton({ data }: ROISummaryProps) {
  const { headline, kpis, trend, recentRows } = data;
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);

  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Tasks Done': { icon: Activity, color: STATUS.info },
    'Hours Saved': { icon: Clock, color: STATUS.success },
    'Cost per Task': { icon: DollarSign, color: STATUS.warning },
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </ThemedCard>
        </motion.div>
      )}
    </div>
  );
}
