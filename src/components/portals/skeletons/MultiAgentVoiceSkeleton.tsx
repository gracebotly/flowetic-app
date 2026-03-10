'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Flex } from '@tremor/react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import {
  ThemedCard,
  KPICard,
  StatusBadge,
  fadeUp,
} from '@/components/portals/shared/portalPrimitives';
import { SkeletonHealthBanner } from '@/components/portals/shared/SkeletonEmptyState';
import { DataFreshnessBar } from '@/components/portals/shared/DataFreshnessBar';
import {
  getThemeTokens,
  STATUS,
  DEFAULT_ACCENT,
  type ThemeTokens,
} from '@/lib/portals/themeTokens';
import type { SkeletonData } from '@/lib/portals/transformData';

interface MultiAgentVoiceProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

function CallRow({
  row,
  tokens,
}: {
  row: Record<string, unknown>;
  tokens: ThemeTokens;
}) {
  const hasSummary =
    typeof row.call_summary === 'string' && row.call_summary.length > 0;
  const hasError =
    typeof row.error_message === 'string' && row.error_message.length > 0;
  const hasCost =
    typeof row.cost === 'string' &&
    row.cost.length > 0 &&
    row.cost !== '$0.00';
  const [expanded, setExpanded] = useState(false);
  const hasExtra = hasSummary || hasError;

  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: tokens.border }}
    >
      <button
        onClick={() => hasExtra && setExpanded(!expanded)}
        className={`w-full text-left transition-colors duration-150 ${
          hasExtra ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{
          backgroundColor: expanded ? tokens.bgExpanded : 'transparent',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${STATUS.info}15` }}
          >
            <Phone className="h-4 w-4" style={{ color: STATUS.info }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate text-sm font-medium"
                style={{ color: tokens.textPrimary }}
              >
                {String(row.name)}
              </span>
              <StatusBadge status={String(row.status)} />
            </div>
            <div
              className="mt-0.5 flex items-center gap-3 text-xs"
              style={{ color: tokens.textMuted }}
            >
              <span>{String(row.duration)}</span>
              {hasCost && <span>{String(row.cost)}</span>}
            </div>
          </div>
          <span className="text-xs" style={{ color: tokens.textMuted }}>
            {String(row.time)}
          </span>
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
            <div
              className="ml-11 space-y-1 rounded-lg p-3 text-xs"
              style={{
                backgroundColor: tokens.bgCode,
                border: `1px solid ${tokens.borderCode}`,
              }}
            >
              {hasSummary && (
                <p style={{ color: tokens.textPrimary }}>
                  {String(row.call_summary)}
                </p>
              )}
              {hasError && (
                <p style={{ color: STATUS.error }}>
                  {String(row.error_message)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentTabContent({
  agent,
  accent,
  tokens,
  index,
}: {
  agent: NonNullable<SkeletonData['perAgentData']>[number];
  accent: string;
  tokens: ThemeTokens;
  index: number;
}) {
  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> =
    {
      Calls: { icon: Phone, color: STATUS.info },
      'Success Rate': { icon: CheckCircle2, color: STATUS.success },
      'Avg Duration': { icon: Clock, color: STATUS.info },
      Cost: { icon: DollarSign, color: STATUS.warning },
    };

  return (
    <motion.div
      key={agent.agentId}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={index}
      className="space-y-4 pt-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {agent.kpis.map((kpi, i) => {
          const iconConfig = kpiIcons[kpi.label] ?? {
            icon: Activity,
            color: accent,
          };
          return (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={iconConfig.icon}
              color={iconConfig.color}
              index={i}
            />
          );
        })}
      </div>

      {agent.trend.length > 1 && (
        <ThemedCard>
          <p
            className="text-sm font-semibold"
            style={{ color: tokens.textPrimary }}
          >
            Call Volume
          </p>
          <p
            className="mt-0.5 text-xs"
            style={{ color: tokens.textSecondary }}
          >
            Daily calls — success vs failed
          </p>
          <AreaChart
            className="mt-4 h-48"
            data={agent.trend}
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
      )}

      {agent.recentRows.length > 0 && (
        <ThemedCard className="overflow-hidden p-0">
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: tokens.border }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: tokens.textPrimary }}
            >
              Recent Calls
            </p>
            <p
              className="mt-0.5 text-xs"
              style={{ color: tokens.textSecondary }}
            >
              Last {agent.recentRows.length} calls for this agent
            </p>
          </div>
          <div>
            {agent.recentRows.map((row) => (
              <CallRow
                key={String(row.id)}
                row={row as Record<string, unknown>}
                tokens={tokens}
              />
            ))}
          </div>
        </ThemedCard>
      )}
    </motion.div>
  );
}

export function MultiAgentVoiceSkeleton({
  data,
  branding,
}: MultiAgentVoiceProps) {
  const { headline, kpis, trend, recentRows, perAgentData } = data;
  const { theme } = usePortalTheme();
  const [activeTab, setActiveTab] = useState('all');

  if (data.health.status === 'no-data') {
    return (
      <div className="space-y-6">
        <SkeletonHealthBanner
          health={data.health}
          entityType="voice"
          isAgencyView={false}
        />
      </div>
    );
  }

  const tokens = getThemeTokens(theme);
  const accent = branding.primary_color || DEFAULT_ACCENT;

  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> =
    {
      'Success Rate': { icon: CheckCircle2, color: STATUS.success },
      'Avg Duration': { icon: Clock, color: STATUS.info },
      Failed: { icon: XCircle, color: STATUS.error },
      'Total Cost': { icon: DollarSign, color: STATUS.warning },
    };

  const agents = perAgentData ?? [];

  return (
    <div className="space-y-6">
      {(data.health.status === 'critical' ||
        data.health.status === 'degraded' ||
        data.health.status === 'sparse') && (
        <SkeletonHealthBanner
          health={data.health}
          entityType="voice"
          isAgencyView={false}
        />
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={accent}>
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${
                branding.secondary_color || accent
              })`,
            }}
          />
          <Flex justifyContent="between" alignItems="center" className="pt-2">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: tokens.textSecondary }}
              >
                Voice Operations
              </p>
              <p
                className="mt-1 text-3xl font-bold tracking-tight"
                style={{ color: tokens.textPrimary }}
              >
                {headline.total.toLocaleString()} {headline.totalLabel}
              </p>
              <p
                className="mt-1 flex items-center gap-1.5 text-sm"
                style={{ color: tokens.textSecondary }}
              >
                <Users className="h-3.5 w-3.5" />
                {headline.periodLabel}
              </p>
            </div>
            {headline.percentChange !== null && (
              <div
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{
                  backgroundColor:
                    headline.percentChange >= 0
                      ? `${STATUS.success}10`
                      : `${STATUS.error}10`,
                  color:
                    headline.percentChange >= 0 ? STATUS.success : STATUS.error,
                }}
              >
                {headline.percentChange >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {headline.percentChange >= 0 ? '+' : ''}
                {headline.percentChange}%
              </div>
            )}
          </Flex>
        </ThemedCard>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.slice(0, 4).map((kpi, i) => {
          const iconConfig = kpiIcons[kpi.label] ?? {
            icon: Activity,
            color: accent,
          };
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

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List
          className="flex gap-1 overflow-x-auto rounded-xl p-1"
          style={{ backgroundColor: tokens.bgExpanded }}
          aria-label="Agent tabs"
        >
          <Tabs.Trigger
            value="all"
            className="flex-shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:shadow-sm"
            style={
              activeTab === 'all'
                ? {
                    backgroundColor: tokens.bgCard,
                    color: tokens.textPrimary,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }
                : { color: tokens.textSecondary }
            }
          >
            All Agents
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: `${accent}15`,
                color: accent,
              }}
            >
              {agents.length}
            </span>
          </Tabs.Trigger>

          {agents.map((agent) => (
            <Tabs.Trigger
              key={agent.agentId}
              value={agent.agentId}
              className="flex-shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:shadow-sm"
              style={
                activeTab === agent.agentId
                  ? {
                      backgroundColor: tokens.bgCard,
                      color: tokens.textPrimary,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }
                  : { color: tokens.textSecondary }
              }
            >
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{agent.agentName}</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${STATUS.info}15`,
                    color: STATUS.info,
                  }}
                >
                  {agent.callCount}
                </span>
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="all">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="space-y-4 pt-4"
          >
            {trend.length > 1 && (
              <ThemedCard>
                <p
                  className="text-base font-semibold"
                  style={{ color: tokens.textPrimary }}
                >
                  All Agents Timeline
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: tokens.textSecondary }}
                >
                  Daily calls across all agents — success vs failed
                </p>
                <AreaChart
                  className="mt-4 h-64"
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
            )}

            {recentRows.length > 0 && (
              <ThemedCard className="overflow-hidden p-0">
                <div
                  className="border-b px-5 py-4"
                  style={{ borderColor: tokens.border }}
                >
                  <p
                    className="text-base font-semibold"
                    style={{ color: tokens.textPrimary }}
                  >
                    Activity Feed
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: tokens.textSecondary }}
                  >
                    Recent calls across all agents
                  </p>
                </div>
                <div>
                  {recentRows.map((row) => (
                    <CallRow
                      key={String(row.id)}
                      row={row as Record<string, unknown>}
                      tokens={tokens}
                    />
                  ))}
                </div>
              </ThemedCard>
            )}
          </motion.div>
        </Tabs.Content>

        {agents.map((agent, i) => (
          <Tabs.Content key={agent.agentId} value={agent.agentId}>
            <AgentTabContent
              agent={agent}
              accent={accent}
              tokens={tokens}
              index={i + 3}
            />
          </Tabs.Content>
        ))}
      </Tabs.Root>

      <DataFreshnessBar
        latestEventTimestamp={data.recentRows[0]?.time as string}
      />
    </div>
  );
}
