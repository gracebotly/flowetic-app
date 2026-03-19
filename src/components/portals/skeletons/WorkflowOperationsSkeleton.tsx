'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Text,
  Flex,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from '@tremor/react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Download,
  BarChart3,
} from 'lucide-react';
import { usePortalTheme } from '@/components/portals/PortalShell';
import { ThemedCard, KPICard, StatusBadge, fadeUp, hexToRgba } from '@/components/portals/shared/portalPrimitives';
import type { SkeletonData } from '@/lib/portals/transformData';
import { SkeletonHealthBanner } from '@/components/portals/shared/SkeletonEmptyState';
import { DataFreshnessBar } from '@/components/portals/shared/DataFreshnessBar';
import { getThemeTokens, STATUS } from '@/lib/portals/themeTokens';

interface WorkflowOperationsProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

function getPlatformEntityLabel(platform: string): { single: string; plural: string } {
  if (platform === 'make') return { single: 'Scenario', plural: 'Scenarios' };
  return { single: 'Workflow', plural: 'Workflows' };
}

function formatDataTransfer(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const BASE_FIELDS = new Set([
  'workflow_id', 'workflow_name', 'execution_id', 'status',
  'started_at', 'ended_at', 'duration_ms', 'error_message',
  'platform', 'platformType', 'platform_type',
  'id', 'workflow', 'duration', 'error', 'time',
]);

const FIELD_LABELS: Record<string, string> = {
  operations_used: 'Operations',
  data_transfer_bytes: 'Data Transfer',
  centicredits: 'Credits',
  error_name: 'Error Type',
  error_message: 'Error Message',
  is_instant: 'Instant',
  is_replayable: 'Replayable',
};

function formatFieldValue(key: string, value: unknown): string {
  if (key === 'data_transfer_bytes' && typeof value === 'number') return formatDataTransfer(value);
  if (key === 'centicredits' && typeof value === 'number') return `${(value / 100).toFixed(0)} credits`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getEnrichedFields(row: Record<string, unknown>): Record<string, unknown> {
  const enriched: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (BASE_FIELDS.has(key)) continue;
    if (value === undefined || value === null || value === '' || value === '—') continue;
    enriched[key] = value;
  }
  return enriched;
}

function generateInsights(data: SkeletonData): Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string; recommendation: string }> {
  const insights: Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string; recommendation: string }> = [];
  const { headline, kpis, workflowBreakdown, errorBreakdown } = data;
  const failedKpi = kpis.find(k => k.label === 'Failed');
  const failedCount = typeof failedKpi?.value === 'number' ? failedKpi.value : 0;
  const successRate = headline.total > 0 ? Math.round(((headline.total - failedCount) / headline.total) * 100) : 0;

  if (successRate >= 95) {
    insights.push({ type: 'success', title: 'Excellent reliability', description: `${successRate}% success rate across ${headline.total} executions`, recommendation: 'Performance is strong — consider scaling volume' });
  } else if (successRate < 80) {
    insights.push({ type: 'warning', title: 'High failure rate detected', description: `${failedCount} failures out of ${headline.total} executions (${100 - successRate}% failure rate)`, recommendation: 'Review error logs and check workflow configurations' });
  }
  if (errorBreakdown && errorBreakdown.length > 0) {
    const topError = errorBreakdown[0];
    insights.push({ type: 'warning', title: 'Recurring error pattern', description: `"${topError.message}" occurred ${topError.count} times`, recommendation: 'Investigate this specific failure to reduce error volume' });
  }
  if (workflowBreakdown && workflowBreakdown.length > 1) {
    const topWf = workflowBreakdown[0];
    insights.push({ type: 'info', title: 'Most active workflow', description: `"${topWf.name}" accounts for ${topWf.count} executions (${Math.round((topWf.count / headline.total) * 100)}% of total)`, recommendation: topWf.successRate < 90 ? 'This workflow needs attention — success rate below 90%' : 'Running smoothly' });
  }
  if (headline.percentChange !== null && headline.percentChange > 20) {
    insights.push({ type: 'info', title: 'Volume is growing', description: `${headline.percentChange}% more executions vs previous period`, recommendation: 'Monitor capacity and consider scaling infrastructure' });
  }
  return insights.slice(0, 3);
}

function generateMarkdownReport(data: SkeletonData, portalName: string): string {
  const lines: string[] = [];
  lines.push(`# ${portalName} — Workflow Operations Report`);
  lines.push(`> Generated ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(`## Summary: ${data.headline.total} ${data.headline.totalLabel} (${data.headline.periodLabel})`);
  lines.push('');
  lines.push('## KPIs');
  for (const kpi of data.kpis) lines.push(`- **${kpi.label}:** ${kpi.value}`);
  lines.push('');
  if (data.workflowBreakdown?.length) {
    lines.push('## Workflow Breakdown');
    lines.push('| Workflow | Executions | Success Rate |');
    lines.push('|----------|-----------|-------------|');
    for (const wf of data.workflowBreakdown) lines.push(`| ${wf.name} | ${wf.count} | ${wf.successRate}% |`);
    lines.push('');
  }
  if (data.errorBreakdown?.length) {
    lines.push('## Top Errors');
    lines.push('| Error | Count |');
    lines.push('|-------|-------|');
    for (const err of data.errorBreakdown) lines.push(`| ${err.message} | ${err.count} |`);
    lines.push('');
  }
  if (data.recentRows.length > 0) {
    lines.push('## Recent Executions');
    lines.push('');
    for (const row of data.recentRows) {
      lines.push(`### Execution ${String(row.id || 'N/A')}`);
      lines.push(`- **Workflow:** ${String(row.workflow || 'Unknown')}`);
      lines.push(`- **Status:** ${String(row.status || 'unknown')}`);
      lines.push(`- **Duration:** ${String(row.duration || '—')}`);
      lines.push(`- **Time:** ${String(row.time || '—')}`);
      if (row.error && row.error !== '—') lines.push(`- **Error:** ${String(row.error)}`);
      const enriched = getEnrichedFields(row);
      if (Object.keys(enriched).length > 0) {
        lines.push('- **Data:**');
        for (const [key, value] of Object.entries(enriched))
          lines.push(`  - ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

// ── Expandable execution row ──────────────────────────────────
function ExpandableRow({ row }: { row: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);
  const enriched = getEnrichedFields(row);
  const hasEnriched = Object.keys(enriched).length > 0;
  return (
    <>
      <TableRow
        className={hasEnriched ? 'cursor-pointer' : ''}
        onClick={() => hasEnriched && setExpanded(!expanded)}
        style={{ backgroundColor: expanded ? tokens.bgExpanded : 'transparent' }}
      >
        <TableCell>
          <Flex justifyContent="start" className="gap-1.5">
            {hasEnriched && (
              expanded
                ? <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: tokens.textMuted }} />
                : <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: tokens.textMuted }} />
            )}
            <Text className="font-medium">{String(row.workflow)}</Text>
          </Flex>
        </TableCell>
        <TableCell><StatusBadge status={String(row.status)} /></TableCell>
        <TableCell><Text>{String(row.duration)}</Text></TableCell>
        <TableCell><Text className="text-xs truncate max-w-[200px]">{String(row.error)}</Text></TableCell>
        <TableCell><Text className="text-xs">{String(row.time)}</Text></TableCell>
      </TableRow>
      <AnimatePresence>
        {expanded && hasEnriched && (
          <TableRow>
            <TableCell colSpan={5}>
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <div className="rounded-lg p-3 ml-5 text-xs space-y-1.5" style={{ backgroundColor: tokens.bgCode, border: `1px solid ${tokens.borderCode}` }}>
                  <p className="font-semibold mb-2" style={{ color: tokens.textPrimary }}>Enriched Data</p>
                  {Object.entries(enriched).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium min-w-[120px]" style={{ color: tokens.textSecondary }}>{FIELD_LABELS[key] || key}:</span>
                      <span className="break-all" style={{ color: tokens.textPrimary }}>{formatFieldValue(key, value)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
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

// ── One expandable row in the scenario comparison table ───────
function ScenarioRow({
  wf,
  accent,
  entityLabel,
}: {
  wf: NonNullable<SkeletonData['perWorkflowData']>[number];
  accent: string;
  entityLabel: { single: string; plural: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = usePortalTheme();
  const tokens = getThemeTokens(theme);

  const { successRate, executionCount, avgDurationMs } = wf;
  const failCount = executionCount - Math.round(executionCount * (successRate / 100));
  const rateColor = successRate >= 90 ? STATUS.success : successRate >= 70 ? STATUS.warning : STATUS.error;

  const kpiIconMap: Record<string, { icon: React.ElementType; color: string }> = {
    'Failed':       { icon: XCircle,      color: STATUS.error   },
    'Success Rate': { icon: CheckCircle2, color: STATUS.success  },
    'Avg Runtime':  { icon: Clock,        color: STATUS.info     },
    'Last Run':     { icon: Zap,          color: '#8b5cf6'       },
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

          {/* Name */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: tokens.textPrimary }}>{wf.workflowName}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide" style={{ color: tokens.textMuted }}>{wf.platform}</p>
          </div>

          {/* Executions */}
          <div className="hidden w-16 text-right sm:block">
            <p className="text-sm font-bold tabular-nums" style={{ color: tokens.textPrimary }}>{executionCount.toLocaleString()}</p>
            <p className="text-[11px]" style={{ color: tokens.textMuted }}>runs</p>
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

          {/* Avg runtime */}
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
        <div className="mx-5 mb-3 h-0.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: tokens.border }}>
          <motion.div
            className="h-0.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${successRate}%` }}
            transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
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
                {wf.kpis.map((kpi, i) => {
                  const cfg = kpiIconMap[kpi.label] ?? { icon: Activity, color: accent };
                  return <KPICard key={kpi.label} label={kpi.label} value={kpi.value} icon={cfg.icon} color={cfg.color} index={i} />;
                })}
              </div>

              {/* Trend chart */}
              {wf.trend.length > 1 && (
                <ThemedCard>
                  <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>Execution Trend</p>
                  <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Daily runs — {wf.workflowName}</p>
                  <AreaChart
                    className="mt-4 h-48"
                    data={wf.trend}
                    index="date"
                    categories={['successCount', 'failCount']}
                    colors={['emerald', 'rose']}
                    valueFormatter={(v: number) => v.toLocaleString()}
                    showLegend showAnimation curveType="monotone" showGridLines={false}
                  />
                </ThemedCard>
              )}

              {/* Recent executions */}
              {wf.recentRows.length > 0 && (
                <ThemedCard className="overflow-hidden p-0">
                  <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>Recent Executions</p>
                    <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>Last {wf.recentRows.length} runs</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow style={{ backgroundColor: tokens.bgExpanded }}>
                          <TableHeaderCell style={{ color: tokens.textSecondary }}>{entityLabel.single}</TableHeaderCell>
                          <TableHeaderCell style={{ color: tokens.textSecondary }}>Status</TableHeaderCell>
                          <TableHeaderCell style={{ color: tokens.textSecondary }}>Duration</TableHeaderCell>
                          <TableHeaderCell style={{ color: tokens.textSecondary }}>Error</TableHeaderCell>
                          <TableHeaderCell style={{ color: tokens.textSecondary }}>Time</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {wf.recentRows.map((row) => <ExpandableRow key={row.id} row={row} />)}
                      </TableBody>
                    </Table>
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
export function WorkflowOperationsSkeleton({ data, branding }: WorkflowOperationsProps) {
  const { headline, kpis, trend, recentRows, workflowBreakdown, errorBreakdown, perWorkflowData } = data;
  const detectedPlatform = perWorkflowData?.[0]?.platform
    || ((recentRows[0]?.state as Record<string, unknown> | undefined)?.platform as string)
    || 'n8n';
  const entityLabel = getPlatformEntityLabel(detectedPlatform);
  const hasMultipleWorkflows = perWorkflowData && perWorkflowData.length > 1;
  const { theme } = usePortalTheme();

  if (data.health.status === 'no-data') {
    return <div className="space-y-6"><SkeletonHealthBanner health={data.health} entityType="workflow" isAgencyView={false} /></div>;
  }

  const tokens = getThemeTokens(theme);
  const failedKpi = kpis.find(k => k.label === 'Failed');
  const failedCount = typeof failedKpi?.value === 'number' ? failedKpi.value : 0;
  const successRate = headline.total > 0 ? Math.round(((headline.total - failedCount) / headline.total) * 100) : 0;
  const insights = generateInsights(data);

  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Failed':       { icon: XCircle,      color: '#ef4444' },
    'Success Rate': { icon: CheckCircle2, color: '#10b981' },
    'Avg Runtime':  { icon: Clock,        color: '#3b82f6' },
    'Last Run':     { icon: Zap,          color: '#8b5cf6' },
  };

  return (
    <div className="space-y-6">
      {(data.health.status === 'critical' || data.health.status === 'degraded' || data.health.status === 'sparse') && (
        <SkeletonHealthBanner health={data.health} entityType="workflow" isAgencyView={false} />
      )}

      {/* ─── Hero headline (always shown) ─── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={branding.primary_color}>
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color})` }} />
          <div className="pt-2">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Operations Summary</p>
                <p className="mt-1 text-3xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                  {headline.total.toLocaleString()} {headline.totalLabel}
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: tokens.textSecondary }}>
                  {successRate}% success rate · {headline.periodLabel}
                  {hasMultipleWorkflows && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: hexToRgba(branding.primary_color, 0.12), color: branding.primary_color }}>
                      {perWorkflowData?.length ?? 0} {entityLabel.plural}
                    </span>
                  )}
                </p>
              </div>
              {headline.percentChange !== null && (
                <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold ${headline.percentChange >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
                  {headline.percentChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
                </div>
              )}
            </Flex>
          </div>
        </ThemedCard>
      </motion.div>

      {/* ─── KPI cards (always shown) ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => {
          const cfg = kpiIcons[kpi.label] || { icon: Activity, color: branding.primary_color };
          return <KPICard key={kpi.label} label={kpi.label} value={kpi.value} icon={cfg.icon} color={cfg.color} trend={kpi.trend} trendValue={kpi.trendValue} index={i + 1} />;
        })}
      </div>

      {/* ─── Make resource metrics (always shown when present) ─── */}
      {(data.operationsConsumed || data.dataTransferTotal || data.estimatedCost) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.operationsConsumed != null && data.operationsConsumed > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={kpis.length + 1}>
              <ThemedCard>
                <Flex justifyContent="between" alignItems="start">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Operations Consumed</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>{data.operationsConsumed.toLocaleString()}</p>
                    <p className="mt-1 text-xs" style={{ color: tokens.textMuted }}>Total Make operations</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: hexToRgba(branding.primary_color, 0.2) }}>
                    <Zap className="h-5 w-5" style={{ color: branding.primary_color }} />
                  </div>
                </Flex>
              </ThemedCard>
            </motion.div>
          )}
          {data.dataTransferTotal != null && data.dataTransferTotal > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={kpis.length + 2}>
              <ThemedCard>
                <Flex justifyContent="between" alignItems="start">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Data Transfer</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>{formatDataTransfer(data.dataTransferTotal)}</p>
                    <p className="mt-1 text-xs" style={{ color: tokens.textMuted }}>Total bytes transferred</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${STATUS.info}20` }}>
                    <Activity className="h-5 w-5" style={{ color: STATUS.info }} />
                  </div>
                </Flex>
              </ThemedCard>
            </motion.div>
          )}
          {data.estimatedCost != null && data.estimatedCost > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={kpis.length + 3}>
              <ThemedCard>
                <Flex justifyContent="between" alignItems="start">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>Credits Used</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>{Math.round(data.estimatedCost).toLocaleString()}</p>
                    <p className="mt-1 text-xs" style={{ color: tokens.textMuted }}>Make credits consumed</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${STATUS.info}20` }}>
                    <Zap className="h-5 w-5" style={{ color: STATUS.info }} />
                  </div>
                </Flex>
              </ThemedCard>
            </motion.div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MULTI-WORKFLOW: Scenario Overview Table
          Replaces old tabs — shows every scenario at a glance.
          Click any row to expand KPIs + trend + executions.
         ══════════════════════════════════════════════════════ */}
      {hasMultipleWorkflows && perWorkflowData && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
          <ThemedCard className="overflow-hidden p-0">
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${tokens.border}` }}>
              <div>
                <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>{entityLabel.plural} Overview</p>
                <p className="mt-0.5 text-xs" style={{ color: tokens.textSecondary }}>
                  Click any {entityLabel.single.toLowerCase()} to drill into its metrics
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
              <span>{entityLabel.single}</span>
              <span className="hidden text-right sm:block">Runs</span>
              <span className="text-right">Success</span>
              <span className="hidden text-right sm:block">Fails</span>
              <span className="hidden text-right md:block">Avg Time</span>
              <span />
            </div>

            {/* Rows */}
            <div>
              {perWorkflowData.map((wf) => (
                <ScenarioRow key={wf.workflowId} wf={wf} accent={branding.primary_color} entityLabel={entityLabel} />
              ))}
            </div>
          </ThemedCard>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════
          SINGLE WORKFLOW: full analytics view (unchanged)
         ══════════════════════════════════════════════════════ */}
      {!hasMultipleWorkflows && (
        <>
          {trend.length > 1 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
              <ThemedCard>
                <Flex justifyContent="between" alignItems="center" className="mb-4">
                  <div>
                    <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Execution Volume</p>
                    <p className="text-xs mt-0.5" style={{ color: tokens.textSecondary }}>Daily executions — success vs failed</p>
                  </div>
                </Flex>
                <AreaChart className="h-72" data={trend} index="date" categories={['successCount', 'failCount']} colors={['emerald', 'rose']} valueFormatter={(v: number) => v.toLocaleString()} showLegend showAnimation curveType="monotone" showGridLines={false} />
              </ThemedCard>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {workflowBreakdown && workflowBreakdown.length > 0 && (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
                <ThemedCard>
                  <Flex justifyContent="start" className="gap-2 mb-4">
                    <BarChart3 className="h-4 w-4" style={{ color: branding.primary_color }} />
                    <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Workflow Performance</p>
                  </Flex>
                  <div className="space-y-3">
                    {workflowBreakdown.slice(0, 5).map((wf) => (
                      <div key={wf.name} className="space-y-1.5">
                        <Flex justifyContent="between">
                          <p className="text-sm truncate max-w-[200px]" style={{ color: tokens.textPrimary }}>{wf.name}</p>
                          <Flex justifyContent="end" className="gap-2">
                            <span className="text-xs font-medium" style={{ color: tokens.textSecondary }}>{wf.count} runs</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${wf.successRate >= 90 ? 'bg-emerald-500/10 text-emerald-500' : wf.successRate >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-400'}`}>{wf.successRate}%</span>
                          </Flex>
                        </Flex>
                        <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: tokens.border }}>
                          <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${wf.successRate}%`, backgroundColor: wf.successRate >= 90 ? '#10b981' : wf.successRate >= 70 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ThemedCard>
              </motion.div>
            )}

            {insights.length > 0 && (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
                <ThemedCard>
                  <Flex justifyContent="start" className="gap-2 mb-4">
                    <Lightbulb className="h-4 w-4" style={{ color: STATUS.warning }} />
                    <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Key Insights</p>
                  </Flex>
                  <div className="space-y-3">
                    {insights.map((insight, i) => {
                      const InsightIcon = insight.type === 'success' ? CheckCircle2 : insight.type === 'warning' ? AlertTriangle : Lightbulb;
                      const insightColor = insight.type === 'success' ? STATUS.success : insight.type === 'warning' ? STATUS.warning : STATUS.info;
                      return (
                        <div key={i} className="rounded-lg p-3 transition-colors" style={{ backgroundColor: tokens.bgExpanded, border: `1px solid ${tokens.border}` }}>
                          <Flex justifyContent="start" className="gap-2 mb-1">
                            <InsightIcon className="h-4 w-4 flex-shrink-0" style={{ color: insightColor }} />
                            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{insight.title}</p>
                          </Flex>
                          <p className="text-xs ml-6" style={{ color: tokens.textSecondary }}>{insight.description}</p>
                          <p className="text-xs ml-6 mt-1 font-medium" style={{ color: insightColor }}>{insight.recommendation}</p>
                        </div>
                      );
                    })}
                  </div>
                </ThemedCard>
              </motion.div>
            )}
          </div>

          {errorBreakdown && errorBreakdown.length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
              <ThemedCard>
                <Flex justifyContent="start" className="gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Top Errors</p>
                </Flex>
                <div className="space-y-2.5">
                  {errorBreakdown.slice(0, 5).map((err, i) => (
                    <Flex key={i} justifyContent="between" alignItems="center">
                      <p className="truncate text-xs max-w-[320px]" style={{ color: tokens.textPrimary }}>{err.message}</p>
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">{err.count}×</span>
                    </Flex>
                  ))}
                </div>
                {data.errorNameBreakdown && data.errorNameBreakdown.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.errorNameBreakdown.map((en) => (
                      <span key={en.name} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${STATUS.error}10`, color: STATUS.error }}>
                        {en.name} <span style={{ opacity: 0.7 }}>×{en.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </ThemedCard>
            </motion.div>
          )}

          {recentRows.length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
              <ThemedCard>
                <Flex justifyContent="between" alignItems="center" className="mb-4">
                  <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Recent Executions</p>
                  <button
                    onClick={() => {
                      const md = generateMarkdownReport(data, branding.portalName);
                      const blob = new Blob([md], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${branding.portalName.replace(/\s+/g, '-').toLowerCase()}-report.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ backgroundColor: hexToRgba(branding.primary_color, 0.15), color: branding.primary_color }}
                  >
                    <Download className="h-3.5 w-3.5" />Export
                  </button>
                </Flex>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>{entityLabel.single}</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Duration</TableHeaderCell>
                        <TableHeaderCell>Error</TableHeaderCell>
                        <TableHeaderCell>Time</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentRows.map((row) => <ExpandableRow key={row.id} row={row} />)}
                    </TableBody>
                  </Table>
                </div>
              </ThemedCard>
            </motion.div>
          )}
        </>
      )}

      <DataFreshnessBar latestEventTimestamp={recentRows[0]?.time as string} />
    </div>
  );
}
