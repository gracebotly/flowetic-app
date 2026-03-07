'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Flex } from '@tremor/react';
import {
  Activity,
  Phone,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { ThemedCard, KPICard, StatusBadge, fadeUp } from '@/components/portals/shared/portalPrimitives';
import { getThemeTokens, STATUS, DEFAULT_ACCENT, type ThemeTokens } from '@/lib/portals/themeTokens';
import type { SkeletonData } from '@/lib/portals/transformData';

interface CombinedOverviewProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

function PlatformCard({ label, icon: Icon, data, accent, tokens }: {
  label: string;
  icon: React.ElementType;
  data: { count: number; successRate: number; platforms: string[] };
  accent: string;
  tokens: ThemeTokens;
}) {
  const tone = data.successRate >= 90 ? STATUS.success : data.successRate >= 70 ? STATUS.warning : STATUS.error;

  return (
    <ThemedCard>
      <Flex justifyContent="between" alignItems="start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}15` }}>
              <Icon className="h-4 w-4" style={{ color: accent }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              {label}
            </p>
          </div>
          <p className="mt-3 text-2xl font-bold" style={{ color: tokens.textPrimary }}>
            {data.count.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
            events · {data.platforms.join(', ')}
          </p>
        </div>
        <div className="text-right">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ backgroundColor: `${tone}15`, color: tone }}
          >
            {data.successRate}%
          </span>
        </div>
      </Flex>
      <div className="mt-3 h-1.5 w-full rounded-full" style={{ backgroundColor: tokens.border }}>
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${data.successRate}%`, backgroundColor: tone }}
        />
      </div>
    </ThemedCard>
  );
}

function ActivityRow({ row, tokens }: { row: Record<string, unknown>; tokens: ThemeTokens }) {
  const [expanded, setExpanded] = useState(false);
  const platform = String(row.platform || 'unknown');
  const platformCategory = String(row.platformCategory || 'workflow');
  const isVoice = platformCategory === 'voice';
  const hasSummary = typeof row.call_summary === 'string' && row.call_summary.length > 0;
  const hasErrorMessage = typeof row.error_message === 'string' && row.error_message.length > 0;
  const hasCost = typeof row.cost === 'string' && row.cost.length > 0 && row.cost !== '$0.00';
  const hasExtra = hasErrorMessage || Boolean(row.transcript) || hasSummary;

  const platformColor = isVoice ? STATUS.info : STATUS.success;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: tokens.border }}>
      <button
        onClick={() => hasExtra && setExpanded(!expanded)}
        className={`w-full text-left transition-colors ${hasExtra ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ backgroundColor: expanded ? tokens.bgExpanded : 'transparent' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${platformColor}15` }}>
            {isVoice
              ? <Phone className="h-4 w-4" style={{ color: platformColor }} />
              : <Cpu className="h-4 w-4" style={{ color: platformColor }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium" style={{ color: tokens.textPrimary }}>
                {String(row.name)}
              </span>
              <StatusBadge status={String(row.status)} />
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: `${platformColor}10`, color: platformColor }}
              >
                {platform}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs" style={{ color: tokens.textMuted }}>
              <span>{String(row.duration)}</span>
              {hasCost && <span>{String(row.cost)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: tokens.textMuted }}>{String(row.time)}</span>
            {hasExtra && (
              expanded
                ? <ChevronDown className="h-4 w-4" style={{ color: tokens.textMuted }} />
                : <ChevronRight className="h-4 w-4" style={{ color: tokens.textMuted }} />
            )}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && hasExtra && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-3"
          >
            <div className="ml-11 space-y-1 rounded-lg p-3 text-xs" style={{ backgroundColor: tokens.bgCode, border: `1px solid ${tokens.borderCode}` }}>
              {hasSummary && <p style={{ color: tokens.textPrimary }}>{String(row.call_summary)}</p>}
              {hasErrorMessage && <p style={{ color: STATUS.error }}>{String(row.error_message)}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CombinedOverviewSkeleton({ data, branding }: CombinedOverviewProps) {
  const { headline, kpis, trend, recentRows, platformComparison } = data;
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const accent = branding.primary_color || DEFAULT_ACCENT;

  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Success Rate': { icon: CheckCircle2, color: STATUS.success },
    'Avg Duration': { icon: Clock, color: STATUS.info },
    Failed: { icon: XCircle, color: STATUS.error },
    'Total Cost': { icon: DollarSign, color: STATUS.warning },
  };

  return (
    <div className="space-y-6">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={accent}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${branding.secondary_color || accent})` }} />
          <Flex justifyContent="between" alignItems="center" className="pt-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Unified Operations</p>
              <p className="mt-1 text-3xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                {headline.total.toLocaleString()} {headline.totalLabel}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.slice(0, 4).map((kpi, i) => {
          const iconConfig = kpiIcons[kpi.label] || { icon: Activity, color: accent };
          return (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={iconConfig.icon}
              color={iconConfig.color}
              index={i + 1}
            />
          );
        })}
      </div>

      {platformComparison && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <PlatformCard label="Voice Platforms" icon={Phone} data={platformComparison.voice} accent={STATUS.info} tokens={tokens} />
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <PlatformCard label="Workflow Platforms" icon={Cpu} data={platformComparison.workflow} accent={STATUS.success} tokens={tokens} />
          </motion.div>
        </div>
      )}

      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <ThemedCard>
            <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Unified Timeline</p>
            <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Daily activity — success vs failed</p>
            <AreaChart
              className="mt-4 h-72"
              data={trend}
              index="date"
              categories={['successCount', 'failCount']}
              colors={['emerald', 'rose']}
              valueFormatter={(v: number) => v.toLocaleString()}
              showLegend
              showAnimation
              curveType="monotone"
              showGridLines={false}
            />
          </ThemedCard>
        </motion.div>
      )}

      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
          <ThemedCard className="p-0 overflow-hidden">
            <div className="border-b px-5 py-4" style={{ borderColor: tokens.border }}>
              <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Activity Feed</p>
              <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Recent operations across all connected platforms</p>
            </div>
            <div>
              {recentRows.map((row) => (
                <ActivityRow key={String(row.id)} row={row as Record<string, unknown>} tokens={tokens} />
              ))}
            </div>
          </ThemedCard>
        </motion.div>
      )}
    </div>
  );
}
