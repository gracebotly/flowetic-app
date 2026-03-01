'use client';

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
  const color = status === 'success' ? 'emerald' : status === 'error' ? 'red' : status === 'waiting' ? 'amber' : 'gray';
  const label = status === 'success' ? 'Success' : status === 'error' ? 'Failed' : status;
  return <Badge color={color} size="xs">{label}</Badge>;
}

export function WorkflowOperationsSkeleton({ data }: WorkflowOperationsProps) {
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
                className="mt-4 h-52"
                data={workflowBreakdown.slice(0, 8)}
                index="name"
                categories={['count']}
                colors={['blue']}
                valueFormatter={(v: number) => v.toLocaleString()}
                showAnimation
                layout="vertical"
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
            <Title>Recent Executions</Title>
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
                  <TableRow key={row.id}>
                    <TableCell>
                      <Text className="font-medium">{String(row.workflow)}</Text>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(row.status)} />
                    </TableCell>
                    <TableCell><Text>{String(row.duration)}</Text></TableCell>
                    <TableCell>
                      <Text className="text-xs truncate max-w-[200px]">{String(row.error)}</Text>
                    </TableCell>
                    <TableCell><Text className="text-xs">{String(row.time)}</Text></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
