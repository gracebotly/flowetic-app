'use client';

import { motion } from 'framer-motion';
import { AreaChart, BadgeDelta, Card, Flex, Grid, Metric, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Text, Title } from '@tremor/react';
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

export function ROISummarySkeleton({ data }: ROISummaryProps) {
  const { headline, kpis, trend, recentRows } = data;

  return (
    <div className="space-y-6">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <Card decoration="top" decorationColor="emerald">
          <Flex justifyContent="between" alignItems="center">
            <div>
              <Text>ROI Summary</Text>
              <Metric>Est. ${headline.total.toLocaleString()} saved this month</Metric>
              <Text className="mt-1">{headline.periodLabel}</Text>
            </div>
            {headline.percentChange !== null ? (
              <BadgeDelta deltaType={headline.percentChange >= 0 ? 'increase' : 'decrease'} size="lg">
                {headline.percentChange >= 0 ? '+' : ''}{headline.percentChange}%
              </BadgeDelta>
            ) : null}
          </Flex>
        </Card>
      </motion.div>

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

      {trend.length > 1 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <Card>
            <Title>Cumulative savings — 30d</Title>
            <AreaChart
              className="mt-4 h-72"
              data={trend}
              index="date"
              categories={['count']}
              colors={['emerald']}
              valueFormatter={(v: number) => `$${v.toLocaleString()}`}
              showAnimation
              curveType="monotone"
            />
          </Card>
        </motion.div>
      ) : null}

      {recentRows.length > 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
          <Card>
            <Title>Breakdown by type</Title>
            <Table className="mt-4">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Count</TableHeaderCell>
                  <TableHeaderCell>Est Savings</TableHeaderCell>
                  <TableHeaderCell>Cost / Task</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{String(row.type)}</TableCell>
                    <TableCell>{String(row.count)}</TableCell>
                    <TableCell>{String(row.estSavings)}</TableCell>
                    <TableCell>{String(row.costPerTask)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}
