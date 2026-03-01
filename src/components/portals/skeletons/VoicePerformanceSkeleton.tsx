'use client';

import { motion } from 'framer-motion';
import {
  AreaChart,
  DonutChart,
  BarChart,
  LineChart,
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

interface VoicePerformanceProps {
  data: SkeletonData;
  branding: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string | null;
    portalName: string;
  };
}

// ── Animation Variants ────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const color = status === 'success' ? 'emerald' : status === 'error' ? 'red' : 'gray';
  const label = status === 'success' ? 'Completed' : status === 'error' ? 'Failed' : status;
  return <Badge color={color} size="xs">{label}</Badge>;
}

// ── Sentiment Badge ───────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: string }) {
  const lower = sentiment.toLowerCase();
  const color = lower === 'positive' ? 'emerald' : lower === 'negative' ? 'red' : 'amber';
  return <Badge color={color} size="xs">{sentiment}</Badge>;
}

export function VoicePerformanceSkeleton({ data, branding }: VoicePerformanceProps) {
  const { headline, kpis, trend, recentRows, endedReasonBreakdown, assistantBreakdown, sentimentBreakdown, costTrend } = data;

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Headline Block ─── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <Card decoration="top" decorationColor={branding.primary_color === '#3B82F6' ? 'blue' : 'indigo'}>
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>Performance Summary</Text>
              <Metric className="mt-1">
                {headline.total.toLocaleString()} {headline.totalLabel}
              </Metric>
              <Text className="mt-1 text-tremor-default text-tremor-content">
                {headline.periodLabel}
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

      {/* ─── Section 2: KPI Cards ─── */}
      <Grid numItemsMd={3} className="gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
            <Card>
              <Text>{kpi.label}</Text>
              <Flex justifyContent="between" alignItems="baseline" className="mt-2">
                <Metric>{kpi.value}</Metric>
                {kpi.trendValue && (
                  <BadgeDelta
                    deltaType={kpi.trend === 'up' ? 'increase' : 'decrease'}
                    size="sm"
                  >
                    {kpi.trendValue}
                  </BadgeDelta>
                )}
              </Flex>
            </Card>
          </motion.div>
        ))}
      </Grid>

      {/* ─── Section 3: Call Volume Trend ─── */}
      {trend.length > 1 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <Card>
            <Title>Call Volume</Title>
            <Text>Daily calls over the last 30 days</Text>
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
            />
          </Card>
        </motion.div>
      )}

      {/* ─── Section 4: Ended Reason + Assistant Breakdown (side by side) ─── */}
      <Grid numItemsMd={2} className="gap-4">
        {/* Ended Reason Donut */}
        {endedReasonBreakdown && endedReasonBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <Card>
              <Title>Why Calls End</Title>
              <Text>Distribution of call termination reasons</Text>
              <DonutChart
                className="mt-4 h-52"
                data={endedReasonBreakdown}
                category="count"
                index="reason"
                colors={['blue', 'cyan', 'emerald', 'amber', 'red', 'violet', 'gray']}
                showAnimation
                variant="pie"
              />
            </Card>
          </motion.div>
        )}

        {/* Assistant Performance Bar */}
        {assistantBreakdown && assistantBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <Card>
              <Title>Agent Performance</Title>
              <Text>Calls handled per assistant</Text>
              <BarChart
                className="mt-4 h-52"
                data={assistantBreakdown}
                index="name"
                categories={['count']}
                colors={['blue']}
                valueFormatter={(v: number) => v.toLocaleString()}
                showAnimation
              />
            </Card>
          </motion.div>
        )}
      </Grid>

      {/* ─── Section 5: Sentiment + Cost Trend (side by side, conditional) ─── */}
      <Grid numItemsMd={2} className="gap-4">
        {/* Sentiment (primarily Retell) */}
        {sentimentBreakdown && sentimentBreakdown.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
            <Card>
              <Title>Caller Sentiment</Title>
              <Text>Emotional tone of conversations</Text>
              <DonutChart
                className="mt-4 h-52"
                data={sentimentBreakdown}
                category="count"
                index="sentiment"
                colors={['emerald', 'amber', 'red']}
                showAnimation
              />
            </Card>
          </motion.div>
        )}

        {/* Cost Trend */}
        {costTrend && costTrend.length > 1 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
            <Card>
              <Title>Cost Trend</Title>
              <Text>Daily spend and per-call cost</Text>
              <LineChart
                className="mt-4 h-52"
                data={costTrend}
                index="date"
                categories={['totalCost', 'avgCost']}
                colors={['blue', 'cyan']}
                valueFormatter={(v: number) => `$${v.toFixed(2)}`}
                showLegend
                showAnimation
                curveType="monotone"
              />
            </Card>
          </motion.div>
        )}
      </Grid>

      {/* ─── Section 6: Recent Calls Table ─── */}
      {recentRows.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={9}>
          <Card>
            <Title>Recent Calls</Title>
            <Table className="mt-4">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Assistant</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Duration</TableHeaderCell>
                  <TableHeaderCell>Cost</TableHeaderCell>
                  <TableHeaderCell>Ended Reason</TableHeaderCell>
                  {recentRows.some(r => r.sentiment && r.sentiment !== '—') && (
                    <TableHeaderCell>Sentiment</TableHeaderCell>
                  )}
                  <TableHeaderCell>Time</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Text className="font-medium">{String(row.assistant)}</Text>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(row.status)} />
                    </TableCell>
                    <TableCell><Text>{String(row.duration)}</Text></TableCell>
                    <TableCell><Text>{String(row.cost)}</Text></TableCell>
                    <TableCell><Text className="text-xs">{String(row.endedReason)}</Text></TableCell>
                    {recentRows.some(r => r.sentiment && r.sentiment !== '—') && (
                      <TableCell>
                        {row.sentiment && row.sentiment !== '—'
                          ? <SentimentBadge sentiment={String(row.sentiment)} />
                          : <Text>—</Text>
                        }
                      </TableCell>
                    )}
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
