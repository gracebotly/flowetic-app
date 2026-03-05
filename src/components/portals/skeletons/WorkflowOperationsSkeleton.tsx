'use client';

import React from "react";
import { motion } from 'framer-motion';
import {
  AreaChart,
  BarChart,
  Card,
  Metric,
  Text,
  Flex,
  Badge,
  BadgeDelta,
  Title,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Grid,
} from '@tremor/react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import type { SkeletonData } from '@/lib/portals/transformData';

interface WorkflowOperationsProps {
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
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Success',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-500',
      label: 'Failed',
    },
    waiting: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      label: 'Waiting',
    },
  };

  const c = config[status] ?? {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
    label: status,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}


const BASE_EXECUTION_FIELDS = new Set([
  'workflow_id', 'workflow_name', 'execution_id', 'status',
  'started_at', 'ended_at', 'duration_ms', 'error_message',
  'platform', 'platformType', 'platform_type',
  'id', 'workflow', 'duration', 'error', 'time',
]);

function getEnrichedFields(row: Record<string, unknown>): Record<string, unknown> {
  const enriched: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (BASE_EXECUTION_FIELDS.has(key)) continue;
    if (value === undefined || value === null || value === '' || value === '—') continue;
    enriched[key] = value;
  }
  return enriched;
}

function generateMarkdownReport(
  data: {
    headline: { total: number; totalLabel: string; periodLabel: string };
    kpis: Array<{ label: string; value: string | number }>;
    recentRows: Array<Record<string, unknown>>;
    workflowBreakdown?: Array<{ name: string; count: number; successRate: number }>;
    errorBreakdown?: Array<{ message: string; count: number }>;
  },
  portalName: string
): string {
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
    lines.push('## Recent Executions (Full Detail)');
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
        lines.push('- **Enriched Data:**');
        for (const [key, value] of Object.entries(enriched)) {
          const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
          lines.push(`  - **${key}:** ${display}`);
        }
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function ExpandableRow({ row }: { row: Record<string, unknown> }) {
  const [expanded, setExpanded] = React.useState(false);
  const enriched = getEnrichedFields(row);
  const hasEnriched = Object.keys(enriched).length > 0;
  return (
    <>
      <TableRow
        className={hasEnriched ? 'cursor-pointer hover:bg-gray-50' : ''}
        onClick={() => hasEnriched && setExpanded(!expanded)}
      >
        <TableCell>
          <Flex justifyContent="start" className="gap-1">
            {hasEnriched && (expanded
              ? <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
              : <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
            )}
            <Text className="font-medium">{String(row.workflow)}</Text>
          </Flex>
        </TableCell>
        <TableCell><StatusBadge status={String(row.status)} /></TableCell>
        <TableCell><Text>{String(row.duration)}</Text></TableCell>
        <TableCell><Text className="text-xs truncate max-w-[200px]">{String(row.error)}</Text></TableCell>
        <TableCell><Text className="text-xs">{String(row.time)}</Text></TableCell>
      </TableRow>
      {expanded && hasEnriched && (
        <TableRow>
          <TableCell colSpan={5}>
            <div className="bg-slate-50 rounded-lg p-3 ml-4 text-xs space-y-1">
              <Text className="font-semibold text-gray-700 mb-2">Enriched Data</Text>
              {Object.entries(enriched).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium text-gray-600 min-w-[120px]">{key}:</span>
                  <span className="text-gray-800 break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function WorkflowOperationsSkeleton({ data, branding }: WorkflowOperationsProps) {
  const { headline, kpis, trend, recentRows, workflowBreakdown, errorBreakdown } = data;

  const successRate = headline.total > 0
    ? Math.round(((headline.total - (kpis.find(k => k.label === 'Failed')?.value as number || 0)) / headline.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ─── Headline ─── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <Card decoration="top" decorationColor="blue">
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Operations Summary</Text>
              <Metric className="mt-1">
                {headline.total.toLocaleString()} {headline.totalLabel}
              </Metric>
              <Text className="mt-1">
                {successRate}% success rate · {headline.periodLabel}
              </Text>
            </div>
            {headline.percentChange !== null && (
              <BadgeDelta
                deltaType={headline.percentChange >= 0 ? 'increase' : 'decrease'}
                size="lg"
              >
                {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
              </BadgeDelta>
            )}
          </Flex>
        </Card>
      </motion.div>

      {/* ─── KPIs ─── */}
      <Grid numItemsMd={3} className="gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
            <Card>
              <Text>{kpi.label}</Text>
              <Metric className="mt-2">{kpi.value}</Metric>
            </Card>
          </motion.div>
        ))}
      </Grid>

      {/* ─── Execution Trend ─── */}
      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <Card>
            <Title>Execution Volume</Title>
            <Text>Daily executions — success vs failed</Text>
            <AreaChart
              className="mt-4 h-72"
              data={trend}
              index="date"
              categories={['successCount', 'failCount']}
              colors={['emerald', 'red']}
              valueFormatter={(v: number) => v.toLocaleString()}
              showLegend
              showAnimation
              curveType="monotone"
              stack
            />
          </Card>
        </motion.div>
      )}

      {/* ─── Workflow Breakdown + Error Breakdown (side by side) ─── */}
      <Grid numItemsMd={2} className="gap-4">
        {workflowBreakdown && workflowBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <Card>
              <Title>Workflow Performance</Title>
              <Text>Executions per workflow</Text>
              <BarChart
                className="mt-4 h-72"
                data={workflowBreakdown.slice(0, 6)}
                index="name"
                categories={['count']}
                colors={['blue']}
                valueFormatter={(v: number) => v.toLocaleString()}
                showAnimation
                layout="vertical"
                showGridLines={false}
              />
            </Card>
          </motion.div>
        )}

        {errorBreakdown && errorBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <Card>
              <Title>Top Errors</Title>
              <Text>Most frequent failure reasons</Text>
              <div className="mt-4 space-y-3">
                {errorBreakdown.slice(0, 5).map((err, i) => (
                  <Flex key={i} justifyContent="between" alignItems="center">
                    <Text className="truncate text-xs max-w-[280px]">{err.message}</Text>
                    <Badge color="red" size="xs">{err.count}×</Badge>
                  </Flex>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </Grid>

      {/* ─── Recent Executions Table ─── */}
      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <Card>
            <Flex justifyContent="between" alignItems="center">
              <Title>Recent Executions</Title>
              <button
                onClick={() => {
                  const md = generateMarkdownReport(
                    { headline, kpis, recentRows, workflowBreakdown, errorBreakdown },
                    branding.portalName
                  );
                  const blob = new Blob([md], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${branding.portalName.replace(/\s+/g, '-').toLowerCase()}-report.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export MD
              </button>
            </Flex>
            <Table className="mt-4">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Workflow</TableHeaderCell>
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
          </Card>
        </motion.div>
      )}
    </div>
  );
}
