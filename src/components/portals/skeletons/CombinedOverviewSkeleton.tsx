'use client';

import { motion } from 'framer-motion';
import { AreaChart, Badge, Card, Flex, Grid, Metric, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Text, Title } from '@tremor/react';
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45 },
  }),
};

export function CombinedOverviewSkeleton({ data }: CombinedOverviewProps) {
  const { headline, kpis, trend, recentRows } = data;

  return (
    <div className="space-y-6">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <Card decoration="top" decorationColor="blue">
          <Text>Your AI stack this month</Text>
          <Metric className="mt-2">{headline.total.toLocaleString()} total ops</Metric>
        </Card>
      </motion.div>

      <Grid numItemsMd={2} className="gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
          <Card>
            <Title>Primary KPIs</Title>
            <div className="mt-3 space-y-2">
              <Flex justifyContent="between"><Text>{kpis[0]?.label ?? 'Total'}</Text><Metric>{kpis[0]?.value ?? '—'}</Metric></Flex>
              <Flex justifyContent="between"><Text>{kpis[1]?.label ?? 'Avg Time'}</Text><Metric>{kpis[1]?.value ?? '—'}</Metric></Flex>
            </div>
          </Card>
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <Card>
            <Title>Secondary KPIs</Title>
            <div className="mt-3 space-y-2">
              <Flex justifyContent="between"><Text>{kpis[2]?.label ?? 'Success Rate'}</Text><Metric>{kpis[2]?.value ?? '—'}</Metric></Flex>
              <Flex justifyContent="between"><Text>Change</Text>{headline.percentChange !== null ? <Badge color={headline.percentChange >= 0 ? 'emerald' : 'red'}>{headline.percentChange}%</Badge> : <Text>—</Text>}</Flex>
            </div>
          </Card>
        </motion.div>
      </Grid>

      {trend.length > 1 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
          <Card>
            <Title>Operations over time</Title>
            <AreaChart
              className="mt-4 h-72"
              data={trend}
              index="date"
              categories={['count']}
              colors={['blue']}
              showAnimation
              curveType="monotone"
            />
          </Card>
        </motion.div>
      ) : null}

      {recentRows.length > 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <Card>
            <Title>Unified activity feed</Title>
            <Table className="mt-4">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Time</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{String(row.name)}</TableCell>
                    <TableCell>{String(row.status)}</TableCell>
                    <TableCell>{String(row.type)}</TableCell>
                    <TableCell>{String(row.time)}</TableCell>
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
