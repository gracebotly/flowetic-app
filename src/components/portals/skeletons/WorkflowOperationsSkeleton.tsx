'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import {
  AreaChart,
  Grid,
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
  DollarSign,
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

// ── Enriched field helpers ────────────────────────────────────
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
  if (key === 'centicredits' && typeof value === 'number') return `${value} (≈$${(value / 100).toFixed(2)})`;
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

// ── Key Insights generator ────────────────────────────────────
function generateInsights(data: SkeletonData): Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string; recommendation: string }> {
  const insights: Array<{ type: 'success' | 'warning' | 'info'; title: string; description: string; recommendation: string }> = [];
  const { headline, kpis, workflowBreakdown, errorBreakdown } = data;

  const failedKpi = kpis.find(k => k.label === 'Failed');
  const failedCount = typeof failedKpi?.value === 'number' ? failedKpi.value : 0;
  const successRate = headline.total > 0 ? Math.round(((headline.total - failedCount) / headline.total) * 100) : 0;

  if (successRate >= 95) {
    insights.push({
      type: 'success',
      title: 'Excellent reliability',
      description: `${successRate}% success rate across ${headline.total} executions`,
      recommendation: 'Performance is strong — consider scaling volume',
    });
  } else if (successRate < 80) {
    insights.push({
      type: 'warning',
      title: 'High failure rate detected',
      description: `${failedCount} failures out of ${headline.total} executions (${100 - successRate}% failure rate)`,
      recommendation: 'Review error logs and check workflow configurations',
    });
  }

  if (errorBreakdown && errorBreakdown.length > 0) {
    const topError = errorBreakdown[0];
    insights.push({
      type: 'warning',
      title: 'Recurring error pattern',
      description: `"${topError.message}" occurred ${topError.count} times`,
      recommendation: 'Investigate this specific failure to reduce error volume',
    });
  }

  if (workflowBreakdown && workflowBreakdown.length > 1) {
    const topWf = workflowBreakdown[0];
    insights.push({
      type: 'info',
      title: 'Most active workflow',
      description: `"${topWf.name}" accounts for ${topWf.count} executions (${Math.round((topWf.count / headline.total) * 100)}% of total)`,
      recommendation: topWf.successRate < 90 ? 'This workflow needs attention — success rate below 90%' : 'Running smoothly',
    });
  }

  if (headline.percentChange !== null && headline.percentChange > 20) {
    insights.push({
      type: 'info',
      title: 'Volume is growing',
      description: `${headline.percentChange}% more executions vs previous period`,
      recommendation: 'Monitor capacity and consider scaling infrastructure',
    });
  }

  return insights.slice(0, 3);
}

// ── MD Report generator ───────────────────────────────────────
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
        for (const [key, value] of Object.entries(enriched)) {
          lines.push(`  - ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
        }
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

// ── Expandable Row ────────────────────────────────────────────
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
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="rounded-lg p-3 ml-5 text-xs space-y-1.5"
                  style={{
                    backgroundColor: tokens.bgCode,
                    border: `1px solid ${tokens.borderCode}`,
                  }}
                >
                  <p className="font-semibold mb-2" style={{ color: tokens.textPrimary }}>
                    Enriched Data
                  </p>
                  {Object.entries(enriched).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium min-w-[120px]" style={{ color: tokens.textSecondary }}>
                        {FIELD_LABELS[key] || key}:
                      </span>
                      <span className="break-all" style={{ color: tokens.textPrimary }}>
                        {formatFieldValue(key, value)}
                      </span>
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

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export function WorkflowOperationsSkeleton({ data, branding }: WorkflowOperationsProps) {
  const { headline, kpis, trend, recentRows, workflowBreakdown, errorBreakdown, perWorkflowData } = data;

  // Detect platform from first perWorkflowData entry or from the first recentRow's state
  const detectedPlatform = perWorkflowData?.[0]?.platform
    || ((recentRows[0]?.state as Record<string, unknown> | undefined)?.platform as string)
    || 'n8n';
  const entityLabel = getPlatformEntityLabel(detectedPlatform);
  const hasMultipleWorkflows = perWorkflowData && perWorkflowData.length > 1;
  const { theme } = usePortalTheme();

  // Early return for no-data state
  if (data.health.status === 'no-data') {
    return (
      <div className="space-y-6">
        <SkeletonHealthBanner health={data.health} entityType="workflow" isAgencyView={false} />
      </div>
    );
  }

  const tokens = getThemeTokens(theme);

  const failedKpi = kpis.find(k => k.label === 'Failed');
  const failedCount = typeof failedKpi?.value === 'number' ? failedKpi.value : 0;
  const successRate = headline.total > 0
    ? Math.round(((headline.total - failedCount) / headline.total) * 100)
    : 0;

  const insights = generateInsights(data);

  // KPI icon mapping
  const kpiIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Failed': { icon: XCircle, color: '#ef4444' },
    'Success Rate': { icon: CheckCircle2, color: '#10b981' },
    'Avg Runtime': { icon: Clock, color: '#3b82f6' },
    'Last Run': { icon: Zap, color: '#8b5cf6' },
  };

  return (
    <div className="space-y-6">
      {(data.health.status === 'critical' || data.health.status === 'degraded' || data.health.status === 'sparse') && (
        <SkeletonHealthBanner health={data.health} entityType="workflow" isAgencyView={false} />
      )}

      {hasMultipleWorkflows && perWorkflowData && (
        <Tabs.Root defaultValue={perWorkflowData[0].workflowId} className="space-y-4">
          {/* Tab navigation */}
          <div
            className="flex gap-1 overflow-x-auto rounded-lg p-1"
            style={{ backgroundColor: tokens.bgExpanded, border: `1px solid ${tokens.border}` }}
          >
            <Tabs.List className="flex min-w-full gap-1">
              {perWorkflowData.map((wf) => (
                <Tabs.Trigger
                  key={wf.workflowId}
                  value={wf.workflowId}
                  className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 data-[state=active]:shadow-sm"
                  style={{ color: tokens.textSecondary }}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {wf.workflowName}
                  <span className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: tokens.bgCode, color: tokens.textMuted }}>
                    {wf.executionCount}
                  </span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </div>

          {/* Per-workflow tab panels */}
          {perWorkflowData.map((wf) => (
            <Tabs.Content key={wf.workflowId} value={wf.workflowId} className="space-y-4">
              <Grid numItemsMd={4} className="gap-4">
                {wf.kpis.map((kpi, i) => {
                  const iconInfo = kpiIcons[kpi.label] ?? { icon: Activity, color: branding.primary_color };
                  return (
                    <KPICard
                      key={kpi.label}
                      label={kpi.label}
                      value={kpi.value}
                      icon={iconInfo.icon}
                      color={iconInfo.color}
                      index={i}
                    />
                  );
                })}
              </Grid>
              {wf.trend.length > 1 && (
                <ThemedCard>
                  <h3 className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Execution Trend</h3>
                  <p className="text-sm" style={{ color: tokens.textSecondary }}>Daily runs — {wf.workflowName}</p>
                  <AreaChart className="mt-4 h-48" data={wf.trend} index="date" categories={['successCount', 'failCount']} colors={['emerald', 'rose']} valueFormatter={(v: number) => v.toLocaleString()} showLegend showAnimation curveType="monotone" />
                </ThemedCard>
              )}
              {wf.recentRows.length > 0 && (
                <ThemedCard className="overflow-hidden p-0">
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${tokens.border}`, backgroundColor: tokens.headerBg }}>
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: tokens.textPrimary }}>Recent Executions</h3>
                      <p className="text-sm" style={{ color: tokens.textSecondary }}>Last {wf.recentRows.length} runs</p>
                    </div>
                  </div>
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
                      {wf.recentRows.map((row) => (
                        <ExpandableRow key={row.id} row={row} />
                      ))}
                    </TableBody>
                  </Table>
                </ThemedCard>
              )}
            </Tabs.Content>
          ))}

        </Tabs.Root>
      )}

      {!hasMultipleWorkflows && (
        <>
      {/* ─── Hero Headline ─── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <ThemedCard glow accentColor={branding.primary_color}>
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${branding.primary_color}, ${branding.secondary_color})` }}
          />
          <div className="pt-2">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                  Operations Summary
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                  {headline.total.toLocaleString()} {headline.totalLabel}
                </p>
                <p className="mt-1 text-sm" style={{ color: tokens.textSecondary }}>
                  {successRate}% success rate · {headline.periodLabel}
                </p>
              </div>
              {headline.percentChange !== null && (
                <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold ${
                  headline.percentChange >= 0
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {headline.percentChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
                </div>
              )}
            </Flex>
          </div>
        </ThemedCard>
      </motion.div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => {
          const iconConfig = kpiIcons[kpi.label] || { icon: Activity, color: branding.primary_color };
          return (
            <KPICard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={iconConfig.icon}
              color={iconConfig.color}
              trend={kpi.trend}
              trendValue={kpi.trendValue}
              index={i + 1}
            />
          );
        })}
      </div>


      {/* ─── Resource Metrics (Make-specific, from Phase 0 enrichment) ─── */}
      {(data.operationsConsumed || data.dataTransferTotal || data.estimatedCost) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.operationsConsumed != null && data.operationsConsumed > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={kpis.length + 1}>
              <ThemedCard>
                <Flex justifyContent="between" alignItems="start">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                      Operations Consumed
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                      {data.operationsConsumed.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                      Total Make operations
                    </p>
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
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                      Data Transfer
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                      {formatDataTransfer(data.dataTransferTotal)}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                      Total bytes transferred
                    </p>
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
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
                      Estimated Cost
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
                      ${data.estimatedCost.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                      From Make centicredits
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${STATUS.warning}20` }}>
                    <DollarSign className="h-5 w-5" style={{ color: STATUS.warning }} />
                  </div>
                </Flex>
              </ThemedCard>
            </motion.div>
          )}
        </div>
      )}

      {/* ─── Execution Trend ─── */}
      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <ThemedCard>
            <Flex justifyContent="between" alignItems="center" className="mb-4">
              <div>
                <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>
                  Execution Volume
                </p>
                <p className="text-xs mt-0.5" style={{ color: tokens.textSecondary }}>
                  Daily executions — success vs failed
                </p>
              </div>
            </Flex>
            <AreaChart
              className="h-72"
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

      {/* ─── Workflow Breakdown + Key Insights (side by side) ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {workflowBreakdown && workflowBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <ThemedCard>
              <Flex justifyContent="start" className="gap-2 mb-4">
                <BarChart3 className="h-4 w-4" style={{ color: branding.primary_color }} />
                <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>
                  Workflow Performance
                </p>
              </Flex>
              <div className="space-y-3">
                {workflowBreakdown.slice(0, 5).map((wf) => (
                  <div key={wf.name} className="space-y-1.5">
                    <Flex justifyContent="between">
                      <p className="text-sm truncate max-w-[200px]" style={{ color: tokens.textPrimary }}>
                        {wf.name}
                      </p>
                      <Flex justifyContent="end" className="gap-2">
                        <span className="text-xs font-medium" style={{ color: tokens.textSecondary }}>
                          {wf.count} runs
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          wf.successRate >= 90 ? 'bg-emerald-500/10 text-emerald-500'
                            : wf.successRate >= 70 ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {wf.successRate}%
                        </span>
                      </Flex>
                    </Flex>
                    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: tokens.border }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${wf.successRate}%`,
                          backgroundColor: wf.successRate >= 90 ? '#10b981' : wf.successRate >= 70 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ThemedCard>
          </motion.div>
        )}

        {/* Key Insights */}
        {insights.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <ThemedCard>
              <Flex justifyContent="start" className="gap-2 mb-4">
                <Lightbulb className="h-4 w-4" style={{ color: STATUS.warning }} />
                <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>
                  Key Insights
                </p>
              </Flex>
              <div className="space-y-3">
                {insights.map((insight, i) => {
                  const insightIcon = insight.type === 'success' ? CheckCircle2
                    : insight.type === 'warning' ? AlertTriangle
                    : Lightbulb;
                  const insightColor = insight.type === 'success' ? STATUS.success
                    : insight.type === 'warning' ? STATUS.warning
                    : STATUS.info;
                  const InsightIcon = insightIcon;
                  return (
                    <div
                      key={i}
                      className="rounded-lg p-3 transition-colors"
                      style={{
                        backgroundColor: tokens.bgExpanded,
                        border: `1px solid ${tokens.border}`,
                      }}
                    >
                      <Flex justifyContent="start" className="gap-2 mb-1">
                        <InsightIcon className="h-4 w-4 flex-shrink-0" style={{ color: insightColor }} />
                        <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                          {insight.title}
                        </p>
                      </Flex>
                      <p className="text-xs ml-6" style={{ color: tokens.textSecondary }}>
                        {insight.description}
                      </p>
                      <p className="text-xs ml-6 mt-1 font-medium" style={{ color: insightColor }}>
                        {insight.recommendation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ThemedCard>
          </motion.div>
        )}
      </div>

      {/* ─── Error Breakdown ─── */}
      {errorBreakdown && errorBreakdown.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <ThemedCard>
            <Flex justifyContent="start" className="gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>
                Top Errors
              </p>
            </Flex>
            <div className="space-y-2.5">
              {errorBreakdown.slice(0, 5).map((err, i) => (
                <Flex key={i} justifyContent="between" alignItems="center">
                  <p className="truncate text-xs max-w-[320px]" style={{ color: tokens.textPrimary }}>
                    {err.message}
                  </p>
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400">
                    {err.count}×
                  </span>
                </Flex>
              ))}
            </div>
            {data.errorNameBreakdown && data.errorNameBreakdown.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.errorNameBreakdown.map((en) => (
                  <span
                    key={en.name}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${STATUS.error}10`, color: STATUS.error }}
                  >
                    {en.name} <span style={{ opacity: 0.7 }}>×{en.count}</span>
                  </span>
                ))}
              </div>
            )}
          </ThemedCard>
        </motion.div>
      )}

      {/* ─── Recent Executions Table ─── */}
      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
          <ThemedCard>
            <Flex justifyContent="between" alignItems="center" className="mb-4">
              <p className="text-base font-semibold" style={{ color: tokens.textPrimary }}>
                Recent Executions
              </p>
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
                style={{
                  backgroundColor: hexToRgba(branding.primary_color, 0.15),
                  color: branding.primary_color,
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </Flex>
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
                {recentRows.map((row) => (
                  <ExpandableRow key={row.id} row={row} />
                ))}
              </TableBody>
            </Table>
          </ThemedCard>
        </motion.div>
      )}

      <DataFreshnessBar latestEventTimestamp={recentRows[0]?.time as string} />
        </>
      )}

      {hasMultipleWorkflows && (
        <DataFreshnessBar latestEventTimestamp={recentRows[0]?.time as string} />
      )}
    </div>
  );
}
