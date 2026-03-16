'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Flex } from '@tremor/react';
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
  ChevronDown,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { ThemedCard, KPICard, StatusBadge, fadeUp } from '@/components/portals/shared/portalPrimitives';
import { SkeletonHealthBanner } from '@/components/portals/shared/SkeletonEmptyState';
import { DataFreshnessBar } from '@/components/portals/shared/DataFreshnessBar';
import { getThemeTokens, STATUS, DEFAULT_ACCENT, type ThemeTokens } from '@/lib/portals/themeTokens';
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

// ── Expandable call row ───────────────────────────────────────
function CallRow({ row, tokens }: { row: Record<string, unknown>; tokens: ThemeTokens }) {
  const hasSummary = typeof row.call_summary === 'string' && row.call_summary.length > 0;
  const hasError = typeof row.error_message === 'string' && row.error_message.length > 0;
  const hasCost = typeof row.cost === 'string' && row.cost.length > 0 && row.cost !== '$0.00';
  const [expanded, setExpanded] = useState(false);
  const hasExtra = hasSummary || hasError;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: tokens.border }}>
      <button
        onClick={() => hasExtra && setExpanded(!expanded)}
        className={`w-full text-left transition-colors duration-150 ${hasExtra ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ backgroundColor: expanded ? tokens.bgExpanded : 'transparent' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${STATUS.info}15` }}>
            <Phone className="h-4 w-4" style={{ color: STATUS.info }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium" style={{ color: tokens.textPrimary }}>{String(row.name)}</span>
              <StatusBadge status={String(row.status)} />
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs" style={{ color: tokens.textMuted }}>
              <span>{String(row.duration)}</span>
              {hasCost && <span>{String(row.cost)}</span>}
            </div>
          </div>
          <span className="text-xs" style={{ color: tokens.textMuted }}>{String(row.time)}</span>
        </div>
      </button>
      <AnimatePresence>
        {expanded && hasExtra && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="px-4 pb-3">
            <div className="ml-11 space-y-1 rounded-lg p-3 text-xs" style={{ backgroundColor: tokens.bgCode, border: `1px solid ${tokens.borderCode}` }}>
              {hasSummary && <p style={{ color: tokens.textPrimary }}>{String(row.call_summary)}</p>}
              {hasError && <p style={{ color: STATUS.error }}>{String(row.error_message)}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Live status dot ───────────────────────────────────────────
function StatusDot({ rate }: { rate: number }) {
  const color = rate >= 90 ? STATUS.success : rate >= 70 ? STATUS.warning : STATUS.error;
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ backgroundColor: color }} />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

// ── One expandable agent row in the comparison table ──────────
function AgentRow({
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
  const [expanded, setExpanded] = useState(false);
  const { successRate, callCount, avgDurationMs } = agent;
  const failCount = callCount - Math.round(callCount * (successRate / 100));
  const rateColor = successRate >= 90 ? STATUS.success : successRate >= 70 ? STATUS.warning : STATUS.error;

  const kpiIconMap: Record<string, { icon: React.ElementType; color: string }> = {
    Calls:          { icon: Phone,        color: STATUS.info    },
    'Success Rate': { icon: CheckCircle2, color: STATUS.success },
    'Avg Duration': { icon: Clock,        color: STATUS.info    },
    Cost:           { icon: DollarSign,   color: STATUS.warning },
  };

  return (
    <>
      {/* ── Summary row ── */}
      <div
        className="cursor-pointer border-b last:border-b-0 transition-colors duration-150"
        style={{ borderColor: tokens.border, backgroundColor: expanded ? tokens.bgExpanded : 'transparent' }}
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Live dot */}
          <StatusDot rate={successRate} />

          {/* Agent name + platform */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: tokens.textPrimary }}>{agent.agentName}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide" style={{ color: tokens.textMuted }}>{agent.platform}</p>
          </div>

          {/* Calls */}
          <div className="hidden w-16 text-right sm:block">
            <p className="text-sm font-bold tabular-nums" style={{ color: tokens.textPrimary }}>{callCount.toLocaleString()}</p>
            <p className="text-[11px]" style={{ color: tokens.textMuted }}>calls</p>
          </div>

          {/* Success rate pill */}
          <div className="w-16 text-right">
            <span className="inline-block rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${rateColor}18`, color: rateColor }}>
              {successRate}%
            </span>
          </div>

          {/* Failures */}
          <div className="hidden w-14 text-right sm:block">
            {failCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">
                <XCircle className="h-3 w-3" />{failCount}
              </span>
            ) : (
              <span className="text-xs" style={{ color: tokens.textMuted }}>—</span>
            )}
          </div>

          {/* Avg duration */}
          <div className="hidden w-16 text-right md:block">
            <p className="text-xs tabular-nums" style={{ color: tokens.textSecondary }}>
              {avgDurationMs > 0 ? `${(avgDurationMs / 1000).toFixed(1)}s` : '—'}
            </p>
          </div>

          {/* Chevron */}
          <motion.div className="ml-1 flex-shrink-0" animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4" style={{ color: tokens.textMuted }} />
          </motion.div>
        </div>

        {/* Thin progress bar */}
        <div className="mx-5 mb-3 h-0.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: tokens.border }}>
          <motion.div
            className="h-0.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${successRate}%` }}
            transition={{ duration: 0.9, delay: index * 0.06, ease: 'easeOut' }}
            style={{ backgroundColor: rateColor }}
          />
        </div>
      </div>

      {/* ── Drill-down panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ borderBottom: `1px solid ${tokens.border}` }}
          >
            <div className="space-y-4 p-5" style={{ backgroundColor: tokens.bgExpanded }}>
              {/* KPI strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {agent.kpis.map((kpi, i) => {
                  const cfg = kpiIconMap[kpi.label] ?? { icon: Activity, color: accent };
                  return <KPICard key={kpi.label} label={kpi.label} value={kpi.value} icon={cfg.icon} color={cfg.color} index={i} />;
                })}
              </div>

              {/* Trend chart */}
              {agent.trend.length > 1 && (
                <ThemedCard>
                  <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>Call Volume</p>
                  <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Daily calls — success vs failed</p>
                  <AreaChart
                    className="mt-4 h-48"
                    data={agent.trend}
                    index="date"
                    categories={['successCount', 'failCount']}
                    colors={['emerald', 'rose']}
                    valueFormatter={(v: number) => v.toLocaleString()}
                    showLegend showAnimation curveType="monotone" showGridLines={false}
                  />
                </ThemedCard>
              )}

              {/* Recent calls */}
              {agent.recentRows.length > 0 && (
                <ThemedCard className="overflow-hidden p-0">
                  <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>Recent Calls</p>
                    <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Last {agent.recentRows.length} calls for this agent</p>
                  </div>
                  <div>
                    {agent.recentRows.map((row) => (
                      <CallRow key={String(row.id)} row={row as Record<string, unknown>} tokens={tokens} />
                    ))}
                  </div>
                </ThemedCard>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export function MultiAgentVoiceSkeleton({ data, branding }: MultiAgentVoiceProps) {
  const { headline, kpis, trend, recentRows, perAgentData } = data;
  const { theme } = usePortalTheme();

  if (data.health.status === 'no-data') {
    return <div className="space-y-6"><SkeletonHealthBanner health={data.health} entityType="voice" isAgencyView={false} /></div>;
  }

  const tokens = getThemeTokens(theme);
  const accent = branding.primary_color || DEFAULT_ACCENT;

  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Success Rate': { icon: CheckCircle2, color: STATUS.success },
    'Avg Duration': { icon: Clock,        color: STATUS.info    },
    Failed:         { icon: XCircle,      color: STATUS.error   },
    'Total Cost':   { icon: DollarSign,   color: STATUS.warning },
  };

  const agents = perAgentData ?? [];

  // Aggregate success rate for the headline badge
  const totalCalls = agents.reduce((s, a) => s + a.callCount, 0);
  const overallRate = totalCalls > 0
    ? Math.round(agents.reduce((s, a) => s + a.successRate * a.callCount, 0) / totalCalls)
    : 0;

  return (
    <div className="space-y-6">
      {(data.health.status === 'critical' || data.health.status === 'degraded' || data.health.status === 'sparse') && (
        <SkeletonHealthBanner health={data.health} entityType="voice" isAgencyView={false} />
      )}

      {/* ─── Hero headline ─── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={accent}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${branding.secondary_color || accent})` }} />
          <Flex justifyContent="between" alignItems="center" className="pt-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Voice Operations</p>
              <p className="mt-1 text-3xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                {headline.total.toLocaleString()} {headline.totalLabel}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: tokens.textSecondary }}>
                <Users className="h-3.5 w-3.5" />
                {headline.periodLabel}
                {agents.length > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${accent}18`, color: accent }}>
                    {agents.length} Agent{agents.length !== 1 ? 's' : ''}
                  </span>
                )}
                {overallRate > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${STATUS.success}15`, color: STATUS.success }}>
                    {overallRate}% success
                  </span>
                )}
              </p>
            </div>
            {headline.percentChange !== null && (
              <div
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{ backgroundColor: headline.percentChange >= 0 ? `${STATUS.success}10` : `${STATUS.error}10`, color: headline.percentChange >= 0 ? STATUS.success : STATUS.error }}
              >
                {headline.percentChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
              </div>
            )}
          </Flex>
        </ThemedCard>
      </motion.div>

      {/* ─── KPI cards ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.slice(0, 4).map((kpi, i) => {
          const cfg = kpiIcons[kpi.label] ?? { icon: Activity, color: accent };
          return <KPICard key={kpi.label} label={kpi.label} value={kpi.value} icon={cfg.icon} color={cfg.color} index={i + 1} />;
        })}
      </div>

      {/* ── Overall timeline (above agent table) ── */}
      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="overflow-visible">
          <ThemedCard className="overflow-visible">
            <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>All Agents Timeline</p>
            <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Daily calls across all agents — success vs failed</p>
            <div className="relative mt-4 overflow-visible">
              <AreaChart
                className="h-52 sm:h-64"
                data={trend}
                index="date"
                categories={['successCount', 'failCount']}
                colors={['emerald', 'rose']}
                valueFormatter={(v: number) => v.toLocaleString()}
                showLegend showAnimation curveType="monotone" showGridLines={false}
              />
            </div>
          </ThemedCard>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════
          AGENT OVERVIEW TABLE
          Replaces old tabs — all agents at a glance.
          Click any row to expand KPIs + trend + recent calls.
         ══════════════════════════════════════════════════════ */}
      {agents.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
          <ThemedCard className="overflow-hidden p-0">
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${tokens.border}` }}>
              <div>
                <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Agent Breakdown</p>
                <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>
                  Click any agent to drill into its performance
                </p>
              </div>
              {/* Health legend */}
              <div className="hidden items-center gap-4 sm:flex" style={{ color: tokens.textMuted }}>
                {[{ label: '≥90%', color: STATUS.success }, { label: '70–89%', color: STATUS.warning }, { label: '<70%', color: STATUS.error }].map(({ label, color }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}
                  </span>
                ))}
              </div>
            </div>

            {/* Column labels */}
            <div
              className="grid items-center gap-4 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: '12px 1fr 64px 72px 56px 64px 20px',
                backgroundColor: tokens.bgExpanded,
                color: tokens.textMuted,
              }}
            >
              <span />
              <span>Agent</span>
              <span className="hidden text-right sm:block">Calls</span>
              <span className="text-right">Success</span>
              <span className="hidden text-right sm:block">Fails</span>
              <span className="hidden text-right md:block">Avg Dur</span>
              <span />
            </div>

            {/* Agent rows */}
            <div>
              {agents.map((agent, i) => (
                <AgentRow key={agent.agentId} agent={agent} accent={accent} tokens={tokens} index={i} />
              ))}
            </div>
          </ThemedCard>
        </motion.div>
      )}

      {/* ── Cross-agent activity feed (below table) ── */}
      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <ThemedCard className="overflow-hidden p-0">
            <div className="border-b px-5 py-4" style={{ borderColor: tokens.border }}>
              <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Activity Feed</p>
              <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Recent calls across all agents</p>
            </div>
            <div>
              {recentRows.map((row) => (
                <CallRow key={String(row.id)} row={row as Record<string, unknown>} tokens={tokens} />
              ))}
            </div>
          </ThemedCard>
        </motion.div>
      )}

      <DataFreshnessBar latestEventTimestamp={data.recentRows[0]?.time as string} />
    </div>
  );
}
